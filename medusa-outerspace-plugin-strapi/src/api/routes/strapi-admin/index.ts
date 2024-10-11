import { Request, Response, Router } from 'express';
import * as jwt from 'jsonwebtoken';
import cors from 'cors';
import authenticate from '@medusajs/medusa/dist/api/middlewares/authenticate';
import { ConfigModule } from '@medusajs/types';
import { UserService } from '@medusajs/medusa';
import { parseCorsOrigins } from 'medusa-core-utils';

// Custom imports
import { StrapiMedusaPluginOptions } from '../../../types/globals';


const adminRouter = Router();
export default (app: Router, options: StrapiMedusaPluginOptions, config: ConfigModule) => {
	app.use('/strapi/admin', adminRouter);
	const adminUrl = config.projectConfig.admin_cors;
	const adminCors = {
		origin: parseCorsOrigins(adminUrl),
		credentials: true,
	};

	/** todo additional checks to authenticate strapi request */
	if (process.env.NODE_ENV != 'test') {
		adminRouter.use(cors(adminCors));
	}
	const jwtSecret = config.projectConfig.jwt_secret || (config.projectConfig as any).jwtSecret;
	adminRouter.options('/login', cors(adminCors));
	adminRouter.get('/login', cors(adminCors));
	adminRouter.get('/login', authenticate());
	adminRouter.get('/login', async (req: Request, res: Response) => {
		const userService = req.scope.resolve('userService') as UserService;
		try {
			const user = await userService.retrieve(req.cookies.ajs_user_id);
			delete user.password_hash;
			const signedCookie = jwt.sign(JSON.stringify(user), jwtSecret);
			res.cookie('__medusa_session', signedCookie);
			res.sendStatus(200);
		} catch (error) {
			res.sendStatus(500).send(JSON.stringify(error));
		}
	});

	adminRouter.delete('/login', cors(adminCors));
	adminRouter.delete('/login', (req: Request, res: Response) => {
		res.clearCookie('__medusa_session');
		res.sendStatus(200);
	});

	return adminRouter;
};