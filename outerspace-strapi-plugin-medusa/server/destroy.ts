import { Strapi } from '@strapi/strapi';


export default async ({ strapi }: { strapi: Strapi }) => {
  // Destroy your plugin here
  strapi.log.info('Destroying outerspace-strapi-plugin-medusa');

};
