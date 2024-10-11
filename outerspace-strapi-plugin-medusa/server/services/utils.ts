"use strict";

import { getPluginConfig, setPluginConfig } from "../helpers/pluginConfig";

export interface Config {
    medusaSecret: string;
    medusaBackendUrl: string;
    medusaBackendAdmin: string;
    medusaUser: string;
    medusaPassword: string;
    medusaEmail: string;
    superuserEmail: string;
    superuserUsername: string;
    superuserPassword: string;
    roles: string[];
}

/**
 * Cypher sensitive information
 * 
 */
const cypher = (str) => {
    return str.replace(/./g, "*");
}

/**
 * Build config map object
 *
 */
export const buildConfig = (strapi, hideSensitiveInfo = false) => {
    const pluginConfig = getPluginConfig(strapi);

    const medusaSecret = pluginConfig("MEDUSA_STRAPI_SECRET");
    const superuserPassword = pluginConfig("SUPERUSER_PASSWORD");
    const medusaPassword = pluginConfig("MEDUSA_PASSWORD");

    const config: Config = {
        medusaSecret: hideSensitiveInfo ? cypher(medusaSecret) : medusaSecret,
        medusaBackendUrl: pluginConfig("MEDUSA_BACKEND_URL"),
        medusaBackendAdmin: pluginConfig("MEDUSA_BACKEND_ADMIN"),
        medusaUser: pluginConfig("MEDUSA_USER"),
        medusaPassword: hideSensitiveInfo ? cypher(medusaPassword) :medusaPassword,
        medusaEmail: pluginConfig("MEDUSA_EMAIL"),
        superuserEmail: pluginConfig("SUPERUSER_EMAIL"),
        superuserUsername: pluginConfig("SUPERUSER_USERNAME"),
        superuserPassword: hideSensitiveInfo ? cypher(superuserPassword) : superuserPassword,
        roles: pluginConfig("ROLES"),
    };

    return config;
};

/**
 * Set the plugin configuration
 *
 */
export const setConfig = (strapi, newConfig: Config) => {

    const pluginConfig: any = getPluginConfig(strapi);

    const updatedConfig = {
        ...pluginConfig,
        medusaSecret: newConfig.medusaSecret,
        medusaBackendUrl: newConfig.medusaBackendUrl,
        medusaBackendAdmin: newConfig.medusaBackendAdmin,
        superuserEmail: newConfig.superuserEmail,
        superuserUsername: newConfig.superuserUsername,
        superuserPassword: newConfig.superuserPassword,
    };
    setPluginConfig(strapi, updatedConfig);
}

/**
 * Helper function to Find Content UID with improved name matching
 */
function findContentUid(name, strapi) {
    let objectUid;
    name = name.replace('_', '-').toLowerCase();
    const contentTypes = Object.keys(strapi.contentTypes);

    for (const contentType of contentTypes) {
        const value = strapi.contentTypes[contentType];

        if (value && value.info) {
            const singularName = value.info.singularName.toLowerCase();
            const pluralName = value.info.pluralName.toLowerCase();
            const collectionName = value.collectionName.toLowerCase();

            // Normalized comparison of names
            if (
                collectionName === name ||
                singularName === name ||
                pluralName === name ||
                pluralName.replace('iso-', '') === name  // Handling specific prefix like iso-country
            ) {
                objectUid = `plugin::outerspace-strapi-plugin-medusa.${singularName}`;
            }
        }
    }
    return objectUid;
}

/**
 * Helper fonction to Determine Unique Field
 * 
 */
export function determineUniqueField(uid) {
    return uid.includes('currency') ? 'code' : 'medusa_id';
}

/**
 * Ensure Unique Field String
 */
function ensureUniqueFieldString(dataReceived, uniqueField) {
    if (dataReceived.hasOwnProperty(uniqueField)) {
        dataReceived[uniqueField] = dataReceived[uniqueField].toString();
    }
}

/**
 * Helper function to Find or Create Entity
 * 
 */
async function findOrCreateEntity(uid, strapi, dataReceived, uniqueField) {
    let strapiId = null;
    let uniqueIdentifier = dataReceived[uniqueField];

    // Convert unique identifier to string if it's not already a string
    if (typeof uniqueIdentifier !== 'string') {
        uniqueIdentifier = String(uniqueIdentifier);
        dataReceived[uniqueField] = uniqueIdentifier;
    }

    if (uniqueIdentifier) {
        try {
            // Check if entity already exists
            const foundEntities = await strapi.entityService.findMany(uid, {
                filters: { [uniqueField]: uniqueIdentifier }
            });

            if (foundEntities.length > 0) {
                strapi.log.info(`Found existing entity for ${uid} with ${uniqueField} ${uniqueIdentifier}`);
                strapiId = foundEntities[0].id;

                // Only update if necessary to avoid redundant updates
                await strapi.entityService.update(uid, strapiId, {
                    data: dataReceived  // Use the strapiId directly to update the entity
                });
            } else {

                // Remove ManyToOne relations for the initial creation
                for (const key in dataReceived) {
                    if (key.endsWith('_id')) {
                        // Generate the potential relation name without the "_id" suffix
                        const relationName = key.slice(0, -3);
                        const attribute = strapi.getModel(uid).attributes[relationName];

                        // If the relation exists in the model, map it
                        if (attribute && attribute.relation === 'manyToOne') {
                            delete dataReceived[key];
                        }
                    }
                }

                const newEntity = await strapi.entityService.create(uid, {
                    data: dataReceived
                });

                strapi.log.info(`Created new entity for ${uid} with ${uniqueField} ${uniqueIdentifier}`);
                dataReceived['id'] = newEntity.id;
            }

        } catch (e) {
            strapi.log.error(`Error finding or creating entity for ${uid}: ${e.message}`);
            throw e;
        }
    } else {
        strapi.log.warn(`Unique identifier not found in data for ${uid}`);
    }

    return strapiId;
}

/**
 * Create Nested Entity
 * 
 */
export async function createNestedEntity(uid, strapi, dataReceived) {
    strapi.log.info(`Medusa attaches strapiId or unique identifier from Medusa`);
    if (!dataReceived) return;

    const keys = Object.keys(dataReceived);
    const uniqueField = determineUniqueField(uid);

    // Ensure the unique field exists and is a string
    ensureUniqueFieldString(dataReceived, uniqueField);

    // Handle nested entities
    for (const key of keys) {
        if (Array.isArray(dataReceived[key])) {
            // Initialize an array to store the IDs of the nested entities
            const entityIds = [];

            for (const element of dataReceived[key]) {
                // Derive the uid from the key
                const nestedUid = findContentUid(key, strapi);
                if (nestedUid) {
                    // Create or update the nested entity then replace it with its ID
                    const nestedEntityId = await findOrCreateEntity(nestedUid, strapi, element, uniqueField);
                    if (nestedEntityId) {
                        entityIds.push(nestedEntityId);
                    }
                }
            }
            dataReceived[key] = entityIds;
        } else if (typeof dataReceived[key] === 'object' && dataReceived[key] !== null) {
            // Handle singular nested objects
            const nestedUid = findContentUid(key, strapi);
            if (nestedUid) {
                // Create or update the singular nested entity then replace it with its ID
                const nestedEntityId = await findOrCreateEntity(nestedUid, strapi, dataReceived[key], uniqueField);
                if (nestedEntityId) {
                    dataReceived[key] = nestedEntityId;
                }
            }
        }
    }

    // Create or update the main entity in Strapi
    try {
        await findOrCreateEntity(uid, strapi, dataReceived, uniqueField);

    } catch (e) {
        strapi.log.error(`Error creating or attaching Strapi ID or unique entity: ${e.message}`);
        throw e;
    }

    return dataReceived;
}

