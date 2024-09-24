import { Router } from 'express';
import { ConfigModule } from '@medusajs/medusa/dist/types/global';
import { getConfigFile } from 'medusa-core-utils';

// Custom imports
import adminRouter from './strapi-admin';
import hooksRouter from './hooks';
import contentRouter from './content';

/**
 * Initializes the Medusa Strapi plugin routes
 */
export default (app, options, config: ConfigModule) => {

	// Authenticated routes
	if (!config) {
		/** to support standard @medusajs/medusa */
		const { configModule } = getConfigFile(app, 'medusa-config');
		config = configModule as ConfigModule;
	}
	const strapiRouter = Router();

	hooksRouter(strapiRouter, options);
	contentRouter(strapiRouter, options, config);
	adminRouter(strapiRouter, options, config);

	return strapiRouter;
};