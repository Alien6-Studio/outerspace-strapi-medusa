import { controllerCreate as medusaCreate } from './medusa-controller';

import { 
    handleError, 
    IControllerProps, 
    IError } from './utils';

export function createCustomController(uid: any) {
 
	return {
		async create(ctx: any) {
            const props: IControllerProps = { ctx, strapi, uid };
			return await controllerCreate(props);
		},
	};
}

/**
 * Overwrite the create method for Content Manager (custom controller)
 */
async function controllerCreate(props: IControllerProps) {

	let { ctx, strapi } = props;

    try {
        let result = await medusaCreate(props);
        ctx.body = result.data;
        return (ctx.body);
    } catch (e) {
        handleError(strapi, e as IError);
        return ctx.internalServerError(ctx);
    }
}

