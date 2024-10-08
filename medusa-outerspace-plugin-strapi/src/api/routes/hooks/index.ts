import { Router } from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import rateLimiter from 'express-rate-limit';
import { parseCorsOrigins } from 'medusa-core-utils';

// Custom imports
import utils from '../../middleware/utils';
import { StrapiMedusaPluginOptions } from '../../../types/globals';
import strapiSignal from '../../controllers/hooks/strapi-signal';

const limiter = rateLimiter({
	max: parseInt(process.env.STAPI_HOOKS_MAX_REQUESTS ?? '100') || 100,
	windowMs: parseInt(process.env.STAPI_HOOKS_MAX_DELAY ?? '100000') || 100000, // 100 seconds
	message: "You can't make any more requests at the moment. Try again later",
});
const hooksRouter = Router();

export default (app: Router, options: StrapiMedusaPluginOptions) => {
	app.use('/strapi/hooks', hooksRouter);
	hooksRouter.use(utils);
	hooksRouter.use(limiter);
	const strapiUrl = `${options.strapi_protocol}://${options.strapi_host}:${options.strapi_port}`;

	// Calls all middleware that has been registered to run after authentication.
	const strapiCors = {
		origin: parseCorsOrigins(strapiUrl),
		credentials: true,
	};

	/** todo additional checks to authenticate strapi request */
	if (process.env.NODE_ENV != 'test') {
		hooksRouter.use(cors(strapiCors));
	}

	hooksRouter.post('/strapi-signal', bodyParser.json());
	hooksRouter.post('/strapi-signal', strapiSignal);
	return hooksRouter;
};