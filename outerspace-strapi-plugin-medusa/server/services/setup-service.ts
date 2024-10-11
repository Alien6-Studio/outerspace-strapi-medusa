"use strict";

import { Strapi } from '@strapi/strapi';
import { default as axios } from 'axios';
import _ from 'lodash';
import * as jwt from 'jsonwebtoken';

import { createNestedEntity } from './utils';

let strapi: any;

export function config(myStrapi: Strapi): void {
	strapi = myStrapi;
}

export type StrapiSeedType =
	| Record<string, { medusa_id?: string }[]>
	| Record<string, { medusa_id?: string }>
	| { medusa_id?: string };

export interface StrapiSeedInterface {
	meta: {
		pageNumber: number;
		pageLimit: number;
		hasMore: Record<string, boolean>;
	};
	data: Record<string, StrapiSeedType[]>;
}

export interface RoleParams {
	username: string;
	password: string;
	firstname: string;
	lastname: string;
	email: string;
	blocked: boolean;
	isActive: boolean;
}

export interface MedusaUserParams extends RoleParams {
	confirmed: boolean;
	blocked: boolean;
	provider: string;
	role?: number;
}


/**
 * Create Medusa role
 */
export async function createMedusaRole(permissions: any): Promise<number | undefined> {
	try {
		const medusaRoleId = await hasMedusaRole();
		if (medusaRoleId) {
			return medusaRoleId;
		}
	} catch (e) {
		const error = e as Error;
		strapi.log.warn('Unable to determine with medusa role exists: ' + error.message + ':' + error.stack);
	}

	strapi.log.debug('Creating "Medusa" role');
	const role = {
		name: 'Medusa',
		description: 'Medusa Role',
		permissions,
		users: [],
	};

	try {
		await strapi.plugins['users-permissions'].services.role.createRole(role);
		const medusaRole = await strapi.query('plugin::users-permissions.role').findOne({
			where: {
				name: 'Medusa',
			},
		});

		if (medusaRole && medusaRole.id) {
			strapi.log.info('Role - "Medusa" created successfully');
			const roleId = medusaRole.id;

			// Add permissions to the role
			const newPermissions = {
				'currency': ['find', 'findOne', 'create', 'update', 'delete'],
				'fulfillment-provider': ['find', 'findOne', 'create', 'update', 'delete'],
				'image': ['find', 'findOne', 'create', 'update', 'delete'],
				'iso-country': ['find', 'findOne', 'create', 'update', 'delete'],
				'money-amount': ['find', 'findOne', 'create', 'update', 'delete'],
				'payment-provider': ['find', 'findOne', 'create', 'update', 'delete'],
				'product': ['find', 'findOne', 'create', 'update', 'delete'],
				'product-type': ['find', 'findOne', 'create', 'update', 'delete'],
				'product-tag': ['find', 'findOne', 'create', 'update', 'delete'],
				'product-category': ['find', 'findOne', 'create', 'update', 'delete'],
				'product-collection': ['find', 'findOne', 'create', 'update', 'delete'],
				'product-document': ['find', 'findOne', 'create', 'update', 'delete'],
				'product-legal': ['find', 'findOne', 'create', 'update', 'delete'],
				'product-media': ['find', 'findOne', 'create', 'update', 'delete'],
				'product-metafield': ['find', 'findOne', 'create', 'update', 'delete'],
				'product-option': ['find', 'findOne', 'create', 'update', 'delete'],
				'product-option-requirement': ['find', 'findOne', 'create', 'update', 'delete'],
				'product-option-value': ['find', 'findOne', 'create', 'update', 'delete'],
				'product-variant': ['find', 'findOne', 'create', 'update', 'delete'],
				'region': ['find', 'findOne', 'create', 'update', 'delete'],
				'shipping-option': ['find', 'findOne', 'create', 'update', 'delete'],
				'shipping-option-requirement': ['find', 'findOne', 'create', 'update', 'delete'],
				'shipping-profile': ['find', 'findOne', 'create', 'update', 'delete'],
				'store':['find', 'findOne', 'create', 'update', 'delete'],
			};

			await Promise.all(
				Object.keys(newPermissions).map((controller) => {
					const actions = newPermissions[controller];
					const permissionsToCreate = actions.map((action) => {
						// eslint-disable-next-line no-undef
						return strapi.query('plugin::users-permissions.permission').create({
							data: {
								action: `plugin::outerspace-strapi-plugin-medusa.${controller}.${action}`,
								role: roleId,
							},
						});
					});
				}).flat()
			);
			// Verify or create Medusa user
			const user: MedusaUserParams = {
				username: process.env.MEDUSA_USER || 'medusa',
				password: process.env.MEDUSA_PASSWORD || 'supersecret',
				firstname: '',
				lastname: '',
				email: process.env.MEDUSA_EMAIL || 'admin@medusa-test.com',
				isActive: true,
				confirmed: true,
				blocked: false,
				provider: 'local',
				role: roleId
			}
			await verifyOrCreateMedusaUser(user);
			return roleId;
		}
	} catch (e) {
		const error = e as Error;
		strapi.log.warn('Unable to create with medusa role: ' + error.message + ':' + error.stack);
		return -1;
	}
}

/**
 * Check if Medusa user exists
 */
export async function hasMedusaUser(): Promise<number | boolean> {
	strapi.log.debug('Checking if "medusa_user" exists');
	const user = await strapi.query('plugin::users-permissions.user').findOne({
		where: { username: 'medusa_user' },
	});
	if (user && user.id) {
		strapi.log.info('Found user with username "medusa_user"');
		return user.id;
	} else {
		strapi.log.warn('User with username "medusa_user" not found');
		return false;
	}
}

/**
 * Create Medusa user
 */
export async function deleteAllEntries(): Promise<void> {
	const plugins = await strapi.plugins['users-permissions'].services['users-permissions'].initialize();

	const permissions = await strapi.plugins['users-permissions'].services['users-permissions'].getActions(plugins);
	// flush only apis
	const apisToFlush = Object.keys(permissions).filter((value) => {
		return value.startsWith('api::');
	});
	for (const key of apisToFlush) {
		const controllers = permissions[key].controllers;
		for (const controller of Object.keys(controllers)) {
			const uid = `${key}.${controller}`;
			try {
				await strapi.entityService.deleteMany(uid);
				strapi.log.info(`flushed entity ${uid}`);
			} catch (error) {
				strapi.log.error('unable to flush entity ' + uid, JSON.stringify(error));
			}
		}
	}
	strapi.log.info('All existing entries deleted');
}

/**
 * Create Medusa user
 */
export async function verifyOrCreateMedusaUser(medusaUser: MedusaUserParams): Promise<any> {
	if (!strapi){
		strapi.log.error('strapi object not initialized');
		throw new Error('strapi object not initialized');
	}
	const users = await strapi.plugins['users-permissions'].services.user.fetchAll({
		filters: {
			email: medusaUser.email /** this must refer to STRAPI_MEDUSA_EMAIL */,
		},
	});
	if (users.length) {
		return users[0];
	} else {
		const medusaRole = await strapi.query('plugin::users-permissions.role').findOne({
			where: {
				name: 'Medusa',
			},
		});
		let params = _.cloneDeep(medusaUser);
		params['role'] = medusaRole.id;
		return await createMedusaUser(params);
	}
}

export interface StrapiSignal {
	message: string;
	code: number;
	data: any;
}
export interface MedusaData {
	status: number;
	data: any;
	error?: Error;
}


export async function sendResult(type: string, result: any,origin:"medusa"|"strapi"): Promise<MedusaData | undefined> {
	const postRequestResult = await sendSignalToMedusa('UPDATE MEDUSA', 200, {
		type,
		data: result,
		origin
	});

	if ((postRequestResult?.status ?? 0) >= 200) {
		strapi.log.info(`update to ${type} posted successfully`);
	} else {
		strapi.log.info(`error updating type ${type}`);
	}
	
	return postRequestResult;
}


/**
 * Check if Medusa role exists
 */
async function hasMedusaRole(): Promise<number | undefined> {
	strapi.log.debug('Checking if "Medusa" role exists');
	try {
		const result = await strapi.query('plugin::users-permissions.role').findOne({
			where: { name: 'Medusa' },
		}); /** all users created via medusa will be medusa */
		if (result && result.id) {
			strapi.log.info(`Found role named Medusa with id ${result.id}`);
			return result.id;
		}
	} catch (e) {
		strapi.log.error('Not Found role named Medusa');
	}
}

/**
 * Check if Admin author role exists
 */
async function hasAuthorRole(): Promise<number | undefined> {
	strapi.log.debug('Checking if "Author" role exists');
	try {
		const result = await strapi.query('plugin::users-permissions.role').findOne({
			where: { name: 'Author' },
		});
		if (result) {
			strapi.log.info('Found role named Author');
			return result.id;
		}
		return;
	} catch (e) {
		strapi.log.error('Not Found role named Author');
		return;
	}
}

/**
 * Create User with Admin Author Role
 */
async function createUserWithAdminAuthorRole(user: MedusaUserParams, authorRole: number): Promise<any> {
	const params = _.cloneDeep(user);
	params['role'] = authorRole;
	try {
		const user = await strapi.plugins['users-permissions'].services.user.add(params);
		if (user && user.id) {
			strapi.log.info(`User ${params.username} ${params.email} created successfully with id ${user.id}`);
			return user;
		} else {
			strapi.log.error(`Failed to create user  ${params.username} ${params.email} `);
			return false;
		}
	} catch (error) {
		strapi.log.error((error as Error).message);
		return false;
	}
}

/**
 * Create Medusa user
 * This function creates a user with the Medusa role and attaches the admin author role to it
 * As prerequisites, the Medusa role and the admin author role must already exist
 */
export async function createMedusaUser(medusaUser: MedusaUserParams): Promise<any> {

	// First, we check if the Medusa role exists
	let medusaRole: any;
	try {
		strapi.log.info('creating medusa user');
		medusaRole = await hasMedusaRole();

	} catch (error) {
		strapi.log.error("medusa role doesn't exist", (error as Error).message);
	}

	// Then, we create the user from the information provided
	const params = _.cloneDeep(medusaUser);
	params['role'] = medusaRole;

	try {
		strapi.log.info('creating user with data', JSON.stringify(params));
		const user = await strapi.plugins['users-permissions'].services.user.add(params);

		if (user && user.id) {
			strapi.log.info(`User ${params.username} ${params.email} created successfully with id ${user.id}`);
			strapi.log.info(`Attaching admin author role to ${params.username} ${params.email}`);

			// Check the existence of the admin author role
			const authorRole = await hasAuthorRole();

			if (authorRole) {
				try {
					const result = await createUserWithAdminAuthorRole(params, authorRole);
					if (result) {
						strapi.log.info(`Attached admin author role to ${params.username} ${params.email}`);
					}
				} catch (e) {
					strapi.log.info(`Unable to attach admin author role to ${params.username} ${params.email}`);
				}
			}

			return user;

		} else {
			strapi.log.error(`Failed to create user  ${params.username} ${params.email} `);
			return false;
		}
	} catch (error) {
		strapi.log.error((error as Error).message);
		return false;
	}
}

/**
 * Check if Medusa is ready
 */
async function checkMedusaReady(medusaServer: string, timeout = 30e3, attempts = 1000): Promise<number> {

	let medusaReady = false;
	while (!medusaReady && attempts--) {
		try {
			const response = await axios.head(`${medusaServer}/health`);
			medusaReady = response.status < 300 && response.status >= 200;
			if (medusaReady) {
				break;
			}
			await new Promise((r) => setTimeout(r, timeout));
		} catch (e) {
			strapi.log.info(
				'Unable to connect to Medusa server. Please make sure Medusa server is up and running',
				JSON.stringify(e)
			);
		}
	}
	return attempts;
}

/**
 * Send Signal to Medusa
 */

async function sendSignalToMedusa(
	message = 'Ok',
	code = 200,
	data?: Record<string, any>,
	origin:"medusa"|"strapi" = "strapi"
): Promise<MedusaData | undefined> {

	const medusaServer = `${process.env.MEDUSA_BACKEND_URL || 'http://localhost:9000'}`;
	const strapiSignalHook = `${medusaServer}/strapi/hooks/strapi-signal`;
	const messageData = {
		message,
		code,
		data,
		origin
	};

	// Check medusa server health
	if ((await checkMedusaReady(medusaServer)) == 0) {
		strapi.log.error('abandoning, medusa server dead');
		return;
	}

	try {
		// Sign the message
		const signedMessage = jwt.sign(messageData, process.env.MEDUSA_STRAPI_SECRET || 'no-secret');

		// Send the message
		const result = await axios.post(strapiSignalHook, {
			signedMessage: signedMessage,
		});

		return {
			status: result.status,
			data: result.data,
		};

	} catch (error) {
		if(process.env.NODE_ENV != "test"){
			strapi.log.error(`unable to send message to medusa server  ${(error as Error).message}`);
		}
		else{
			strapi.log.warn(`unable to send message to medusa server test mode  ${(error as Error).message}`);
		}
	}
}

/**
 * Bootrap Services
 * 
 * The service data is received from Medusa and is used to create or update entities in strapi
 * It is called with an array of services and their corresponding data as per defined in the 
 * synchroniseWithMedusa function:
 * 
 */
async function bootstrap(servicesToSync: Record<string, any[]>, pageNumber: number) {
    const strapiApiServicesNames = Object.keys(servicesToSync);
    const strapiApiServicedDataReceivedFromMedusa = Object.values(servicesToSync);

    for (let i = 0; i < strapiApiServicesNames.length; i++) {
		// ServiceName is the key in the servicesToSync object
        const serviceName = strapiApiServicesNames[i];
        const serviceData = strapiApiServicedDataReceivedFromMedusa[i];

        if (Array.isArray(serviceData) && serviceData.length > 0) {
            try {
                for (const entity of serviceData) {
					// Add locale and publishedAt to the entity
                    const entityWithLocale = {
                        ...entity,
                        locale: 'en',
                        publishedAt: new Date(),
                    };

					await createNestedEntity(serviceName, strapi, entityWithLocale);
                }
            } catch (e) {
                strapi.log.error(`Error syncing ${serviceName}:`, JSON.stringify(e));
            }
        } 
    }
}

/**
 * Synchronise Medusa
 */
let isSyncing = false;

async function synchroniseWithMedusa(): Promise<boolean | undefined> {

	// If the sync is already in progress, exit the function immediately
    if (isSyncing) {
        strapi.log.info("Sync process already running. Exiting.");
        return;
    }

	// Mark the sync as in progress
    isSyncing = true;

	const medusaServer = `${process.env.MEDUSA_BACKEND_URL || 'http://localhost:9000'}`;
	const medusaSeedHookUrl = `${medusaServer}/strapi/hooks/seed`;

	// Check medusa server health
	await checkMedusaReady(medusaServer);

	let seedData: StrapiSeedInterface;
	let pageNumber;

	try {
		strapi.log.info(`attempting to sync connect with medusa server on ${medusaSeedHookUrl}`);
		const signalData = await sendSignalToMedusa('SEED');
		seedData = signalData?.data as StrapiSeedInterface;
		pageNumber = seedData?.meta.pageNumber;

	} catch (e) {
		strapi.log.info(
			'Unable to Fetch Seed Data from Medusa server.Please check configuration' + `${JSON.stringify(e)}`
		);
		isSyncing = false;  // Reset syncing flag
		return false;
	}

	if (!seedData) {
		isSyncing = false;  // Reset syncing flag
		return false;
	}

	let continueSeed;

	do {
		continueSeed = false;
		const fulfillmentProviders = seedData?.data?.fulfillmentProviders;
		const paymentProviders = seedData?.data?.paymentProviders;
		const regions = seedData?.data?.regions;
		const shippingOptions = seedData?.data?.shippingOptions;
		const shippingProfiles = seedData?.data?.shippingProfiles;
		const productCollections = seedData?.data?.productCollections;
		const products = seedData?.data?.products;
		const stores = seedData?.data?.stores;

		try {
			// IMPORTANT: Order of seed must be maintained. Please don't change the order
			const servicesToSync = {
				'plugin::outerspace-strapi-plugin-medusa.fulfillment-provider': fulfillmentProviders,
				'plugin::outerspace-strapi-plugin-medusa.payment-provider': paymentProviders,
				'plugin::outerspace-strapi-plugin-medusa.region': regions,
				'plugin::outerspace-strapi-plugin-medusa.shipping-option': shippingOptions,
				'plugin::outerspace-strapi-plugin-medusa.shipping-profile': shippingProfiles,
				'plugin::outerspace-strapi-plugin-medusa.product-collection': productCollections,
				'plugin::outerspace-strapi-plugin-medusa.product': products,
				'plugin::outerspace-strapi-plugin-medusa.store': stores,
			};
			await bootstrap(servicesToSync, pageNumber);

		} catch (e) {
			strapi.log.info('Unable to Sync with to Medusa server. Please check data recieved', JSON.stringify(e));
			isSyncing = false;  // Reset syncing flag
			return false;
		}

		if (seedData) {
			const dataSets = Object.keys(seedData.data);

			for (const dataSet of dataSets) {
				/** fetching more pages */
				if (seedData.meta.hasMore[dataSet]) {
					continueSeed = true;
					try {
						strapi.log.info(`Continuing to sync: Page ${pageNumber + 1} `, medusaSeedHookUrl);
						seedData = (
							await sendSignalToMedusa('SEED', 200, {
								meta: { pageNumber: pageNumber + 1 },
							})
						)?.data as StrapiSeedInterface;
						pageNumber = seedData?.meta.pageNumber;
					} catch (e) {
						strapi.log.info(
							'Unable to Sync with to Medusa server. Please check data recieved',
							JSON.stringify(e)
						);
						isSyncing = false;  // Reset syncing flag
						return false;
					}
					break;
				}
			}
		}
	} while (continueSeed);

	// Reset syncing flag after sync completion
	isSyncing = false;

	strapi.log.info('SYNC FINISHED');
	const result = (await sendSignalToMedusa('SYNC COMPLETED'))?.status == 200;
	return result;
}

/**
 * Return the service object
 */
export default () => ({
	verifyOrCreateMedusaUser,
	synchroniseWithMedusa
});