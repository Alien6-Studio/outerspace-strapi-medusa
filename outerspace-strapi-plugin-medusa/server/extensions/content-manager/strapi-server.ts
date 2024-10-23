'use strict';

import path from 'path';
require('ts-node').register();

import { createCustomController } from "../../controllers/helpers/default-controller";


/**
 * Preload custom controllers from the Medusa plugin
 */
function preloadCustomControllers(plugin: any) {

    const customControllers: { [key: string]: any } = {};

    try {

        const pluginId = 'outerspace-strapi-plugin-medusa';
        const pluginPath = path.dirname(require.resolve(`${pluginId}/package.json`));
        const controllersIndexPath = path.join(pluginPath, 'server', 'controllers', 'index.ts');

        // Import the controllers index file
        const controllersModule = require(controllersIndexPath);
        const controllers = controllersModule.default || controllersModule;

        // Populate customControllers with the controllers from the index file
        Object.keys(controllers).forEach((key) => {

            if (['configController', 'setupController'].includes(key)) {
                return; // Skip these controllers
            }

            const modelName = key;
            let controller = controllers[key];

            // Handle default exports
            controller = controller.default || controller;
            customControllers[modelName] = controller;
        });
        console.log(`Preloaded custom controllers`);

    } catch (err) {
        console.error('Error preloading custom controllers:', err);
    }
}

/**
 * Override the methods of the 'collection-types' controller
 */
function overrideMethods(plugin: any) {

    const originalController = plugin.controllers['collection-types'];
    //const methodsToOverride = ['find', 'findOne', 'create', 'update', 'delete'];
    const methodsToOverride = ['create'];
    methodsToOverride.forEach((methodName) => {

        const originalMethod = originalController[methodName];

        plugin.controllers['collection-types'][methodName] = async function (ctx: any) {

            let uid = ctx.params && ctx.params.uid;
            if (!uid) {
                // Extract the 'uid' from the URL
                const uidMatch = ctx.request.url.match(/\/content-manager\/collection-types\/([^\/?]+)/);
                uid = uidMatch ? decodeURIComponent(uidMatch[1]) : null;
            }

            // Check if the 'uid' matches your plugin's content types
            if (uid && uid.startsWith('plugin::outerspace-strapi-plugin-medusa')) {
                const uidParts = uid.split('.');
                const modelName = uidParts[uidParts.length - 1];

                const customController = createCustomController(uid);

                // Check if the custom controller exists
                if (!customController) {
                    console.error(`No custom controller found for model '${modelName}'.`);
                    return await originalMethod(ctx);
                }

                // Check if the custom controller and method exist
                const customMethod = (customController as { [key: string]: Function })[methodName];
                if (customController && typeof customMethod === 'function') {
                    //return await originalMethod(ctx);
                    const result = await customMethod(ctx);
                    return result;
                } else {
                    console.error(`The custom controller for model '${modelName}' does not have a method '${methodName}'.`);
                    return await originalMethod(ctx);
                }
            } else {
                return await originalMethod(ctx);
            }
        };
    });
}

export function overrideContentManagerForMedusa(plugin: any) {
    preloadCustomControllers(plugin);
    overrideMethods(plugin);
}