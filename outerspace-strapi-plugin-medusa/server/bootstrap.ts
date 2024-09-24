import { Strapi } from '@strapi/strapi';
import pluginId from './helpers/pluginId';

const chalk = require('chalk');

export default async ({ strapi }: { strapi: Strapi }) => {

  /**
   * Create a super admin user
   * This method is called when the plugin is loaded
   * (Not tested)
   */
  async function createSuperAdmin() {
		try {
			const params = {
				username: process.env.SUPERUSER_USERNAME || 'Hurricane',
				password: process.env.SUPERUSER_PASSWORD || 'Alien6@Enghien',
				firstname: process.env.SUPERUSER_FIRSTNAME || 'Harry',
				lastname: process.env.SUPERUSER_LASTNAME || 'Hurricane',
				email: process.env.SUPERUSER_EMAIL || 'hurricane@alien6.com',
				blocked: false,
				isActive: true,
			};

      console.log(chalk.bold('outerspace-strapi-plugin-medusa bootstrap started'));
			const hasAdmin = await strapi.service('admin::user').exists();

			if (hasAdmin) {
				console.log(chalk.bold('Found super admin user'));
			} else {
				const superAdminRole = await strapi.service('admin::role').getSuperAdmin();

				if (!superAdminRole) {
					strapi.log.info('Superuser role exists');
					return;
				}

				await strapi.service('admin::user').create({
					email: params.email,
					firstname: params.firstname,
					username: params.username,
					lastname: params.lastname,
					password: params.password,
					registrationToken: null,
					isActive: true,
					roles: superAdminRole ? [superAdminRole.id] : [],
				});

				strapi.log.info('Superuser account created');
			}
		} catch (err) {
			console.log(err);
		}

		try {
			console.log(chalk.bold('outerspace-strapi-plugin-medusa bootstrap completed'));
		} catch (error) {
			console.log(error);
		}
  }

  await createSuperAdmin();
};
