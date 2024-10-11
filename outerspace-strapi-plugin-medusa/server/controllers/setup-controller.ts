import { Strapi } from "@strapi/strapi";

export default ({ strapi }: { strapi: Strapi }) => ({

    /**
     * Create a medusa user
     */
	async createMedusaUser(ctx) {
		console.log('attempting to create medusa user');
		ctx.body = await strapi
            .plugin('outerspace-strapi-plugin-medusa')
			.service('setupService')
			.verifyOrCreateMedusaUser(ctx.request.body);
		return ctx.body;
	},

    /**
     * 
     * Synchronise Strapi with Medusa
     */
	async synchroniseWithMedusa(ctx) {
        console.log('attempting to synchronise with medusa');
		ctx.body = await strapi
            .plugin('outerspace-strapi-plugin-medusa')
            .service('setupService')
            .synchroniseWithMedusa({ strapi });
		return ctx.body;
	},
});
