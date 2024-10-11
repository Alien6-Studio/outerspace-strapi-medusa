import { Strapi } from '@strapi/strapi';


export default async ({ strapi }: { strapi: Strapi }) => {
  /**
   * This function deletes the Medusa role
   */
  async function deleteMedusaRole() {
    const medusaRole = await strapi.query('admin::role').findOne({ where: { name: 'Medusa' } });
    if (medusaRole) {
      await strapi.query('admin::role').delete({ where: { id: medusaRole.id } });
      strapi.log.info('Medusa role deleted');
    }
  }

  /**
   * This function deletes the super admin user
   */
  async function deleteSuperAdmin() {
    const superAdminUser = await strapi.query('admin::user').findOne({ where: { email: process.env.SUPERUSER_EMAIL } });
    if (superAdminUser) {
      await strapi.query('admin::user').delete({ where: { id: superAdminUser.id } });
      strapi.log.info('Super admin user deleted');
    }
  }

  /**
   * This function resets the public permissions for the Medusa plugin
   */
  async function resetPublicPermissions() {
    const publicRole = await strapi.query('plugin::users-permissions.role').findOne({ where: { type: 'public' } });
    if (publicRole) {
      await strapi.query('plugin::users-permissions.permission').deleteMany({ where: { role: publicRole.id, action_contains: 'plugin::outerspace-strapi-plugin-medusa' } });
      strapi.log.info('Public permissions for Medusa plugin removed');
    }
  }

  /**
   * This function removes the Medusa plugin configuration
   */
  async function removePluginConfig() {
    await strapi.config.remove('plugin::outerspace-strapi-plugin-medusa');
    strapi.log.info('Medusa plugin configuration removed');
  }

  try {
    await deleteMedusaRole();
    await deleteSuperAdmin();
    await resetPublicPermissions();
    await removePluginConfig();
    strapi.log.info('Medusa plugin uninstalled and cleaned up');
  } catch (error) {
    strapi.log.error('Error during Medusa plugin cleanup', error);
  }

};
