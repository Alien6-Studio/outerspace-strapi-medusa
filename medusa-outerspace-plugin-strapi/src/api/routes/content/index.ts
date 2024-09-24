import { Router } from 'express';
import cors from 'cors';
import { ConfigModule } from '@medusajs/medusa/dist/types/global';
import { parseCorsOrigins } from 'medusa-core-utils';


// Custom imports
import fetchContent from '../../controllers/content/fetch-content';
import utils from '../../middleware/utils';

const contentRouter = Router();
export default (app, options, config: ConfigModule) => {
	app.use('/strapi/content', contentRouter);
	const storeCors = config.projectConfig.store_cors || 'http://localhost:8000';
	const adminCors = config.projectConfig.admin_cors || 'http://localhost:8000';
	const strapiCors = {
		origin: [...parseCorsOrigins(storeCors), ...parseCorsOrigins(adminCors)],
		credentials: true,
	};
	if (process.env.NODE_ENV != 'test') {
		contentRouter.use(cors(strapiCors));
	}
	contentRouter.use(utils);

	contentRouter.options('/:type/:id', (req, res, next) => {
		res.setHeader('Allow', 'GET').sendStatus(200);
	});
	contentRouter.options('/:type', (req, res, next) => {
		res.setHeader('Allow', 'GET').sendStatus(200);
	});
	contentRouter.get('/:type/:id', fetchContent);
	contentRouter.get('/:type', fetchContent);

	return contentRouter;
};