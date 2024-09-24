import { Strapi } from "@strapi/strapi";

export default ({ strapi }: { strapi: Strapi }) => ({

  /**
   * Retrieve the configuration
   * 
   */
  async index(ctx) {
    ctx.body = strapi
    .plugin('outerspace-strapi-plugin-medusa')
    .service('configService')
    .getConfig();
  },

  /**
   * Update the configuration
   * 
   */
  async update(ctx) {
    const newConfig = ctx.request.body;
    await strapi.plugin('outerspace-strapi-plugin-medusa')
      .service('configService')
      .setConfig(newConfig);

    ctx.body = { message: 'Configuration updated successfully' };
  }
});
