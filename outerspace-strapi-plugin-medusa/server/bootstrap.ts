import { Strapi } from '@strapi/strapi';
import { config, createMedusaRole, verifyOrCreateMedusaUser }  from './services/setup-service';

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
				username: process.env.SUPERUSER_USERNAME,
				password: process.env.SUPERUSER_PASSWORD,
				firstname: process.env.SUPERUSER_FIRSTNAME,
				lastname: process.env.SUPERUSER_LASTNAME,
				email: process.env.SUPERUSER_EMAIL,
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

  /**
   * Update the public permissions
   */
  async function setPublicPermissions(newPermissions: Record<string, string[]>) {

	const publicRole = await strapi.query('plugin::users-permissions.role').findOne({
		where: {
			type: 'public',
		},
	});

	const allPermissionsToCreate: Promise<any>[] = [];
	Object.keys(newPermissions).map((controller) => {
		const actions = newPermissions[controller];
		const permissionsToCreate = actions.map((action) => {
			// eslint-disable-next-line no-undef
			return strapi.query('plugin::users-permissions.permission').create({
				data: {
					action: `plugin::outerspace-strapi-plugin-medusa.${controller}.${action}`,
					role: publicRole.id,
				},
			});
		});
		allPermissionsToCreate.push(...permissionsToCreate);
	});
	await Promise.all(allPermissionsToCreate);
  }

  // Register the plugin
  config(strapi);

  await createSuperAdmin();

  // Set public permissions
  await setPublicPermissions({
		'product': ['find', 'findOne'],
		'product-type': ['find', 'findOne'],
		'product-tag': ['find', 'findOne'],
		'product-category': ['find', 'findOne'],
		'product-collection': ['find', 'findOne'],
		'product-variant': ['find', 'findOne'],
		'store': ['find', 'findOne'],
	});

	// Create the medusa role
	await createMedusaRole(strapi);
};
