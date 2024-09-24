import role from '@strapi/plugin-users-permissions/server/content-types/role/index';
import passwordGen from 'generate-password';

// Custom imports
import { StrapiMedusaPluginOptions, AuthInterface } from '../types/globals';
import { LoggerHelper } from './helpers/loggerHelper';
import { StrapiHelper } from './helpers/strapiHelper';
import { StrapiServerManager } from './helpers/strapiServerManager';
import { AdminResult, StrapiResult } from './types/types';

export class IamStrapiService {
    private algorithm: string;
    private encryption_key: string;
	private options: StrapiMedusaPluginOptions;
	private loggerHelper: LoggerHelper;
    private strapiHelper: StrapiHelper;
	private defaultAuthInterface: AuthInterface;
	private serverManager: StrapiServerManager;

    constructor(logger: any, strapi_url: string, token: string, options: StrapiMedusaPluginOptions) {
        this.options = options;
		this.algorithm = this.options.encryption_algorithm || 'aes-256-cbc'; // Using AES encryption
        this.encryption_key = this.options.strapi_secret || this.options.strapi_public_key;

        // Initialize the Strapi helper
		this.loggerHelper = new LoggerHelper(logger);
        this.strapiHelper = new StrapiHelper(logger, token, options);
		this.serverManager = this.strapiHelper.getServer();
        this.defaultAuthInterface = this.serverManager.getAuthInterface();
    }

    /**
     * Encypt a text using the encryption key and the algorithm
     * @TODO
     */
	encrypt(text: string): string {
		return text;
	}

    /**
     * Decrypt a text using the encryption key and the algorithm
     * @TODO
     */
	decrypt(text): string {
		return text;
	}

    /**
     * Refresh credentials
     */
	async refreshResend(error: any, id: string, type: string, data: any, method: string, endPoint: string) {
		const credentials = await this.serverManager.strapiLoginSendDatalayer();
	}

	/**
	 * Configure Strapi Medusa for a user
	 */
	async configureStrapiMedusaForUser(authInterface: AuthInterface): Promise<StrapiResult> {
		const { email } = authInterface;
		try {
			const jwt = (await this.serverManager.strapiLoginSendDatalayer(authInterface)).token;
			if (!jwt) {
				this.loggerHelper.log('error', 'no jwt for this user: ' + email);
				return { status: 400 };
			}
			const result = await this.serverManager.executeSync(jwt);
			return { status: result.status };
		} catch (error) {
			this.loggerHelper.log('info', 'Unable to sync An error occurred:', error);
			return { status: 400 };
		}
	}

    /**
	 * Deletes the service account
	 * @returns the deleted default user
	 */

	async deleteDefaultMedusaUser(): Promise<StrapiResult> {
		try {
			const response = await this.deleteMedusaUserFromStrapi(this.defaultAuthInterface);
			this.serverManager.deleteUserToken(this.defaultAuthInterface.email);
			return response;
		} catch (error) {
			this.loggerHelper.log('error', 'unable to delete default user: ' + (error as Error).message);
		}
	}

    /**
	 * Deletes a medusa user from strapi
	 * @param authInterface - the user authorisation parameters
	 * @returns
	 */

	async deleteMedusaUserFromStrapi(authInterface: AuthInterface): Promise<StrapiResult> {
		const fetchedUser = await this.strapiHelper.strapiSendDataLayer({
			method: 'get',
			type: 'users',
			id: 'me',
			data: undefined,
			authInterface,
		});

		this.loggerHelper.log('info', 'found user: ' + JSON.stringify(fetchedUser));

		const result = await this.strapiHelper.executeStrapiSend({
			method: 'delete',
			type: 'users',
			token: this.serverManager.fetchUserToken(authInterface.email),
			id: fetchedUser.id?.toString(),
		});
		return { data: result.data.data ?? result.data, status: result.status };
	}

	/**
	 * Register an Admin User in Strapi
	 * with role Author by default
	 */
	async registerAdminUserInStrapi(
		email: string,
		firstname: string,
		password = passwordGen.generate({
			length: 16,
			numbers: true,
			strict: true,
		}),
		role = 'Author'
	): Promise<AdminResult> {

		// Get the role from the role name
		const roleId = await this.getRoleId(role);
		const auth = {
			email,
			firstname,
			roles: [roleId],
		};

		// Send the request to Strapi
		const result = await this.serverManager.strapiAdminSendDatalayer({
			method: 'post',
			type: 'users',
			id: undefined,
			data: auth,
		});
		return result;
	}

    /**
     * Get the Admin User in Strapi
     */
	async getAdminUserInStrapi(email: string): Promise<AdminResult> {
		const userData = await this.serverManager.strapiAdminSendDatalayer({
			method: 'get',
			type: 'users',
			id: undefined,
			action: undefined,
			query: this.strapiHelper.createStrapiRestQuery({
				fields: ['email'],
				filters: {
					email: `${email}`.toLocaleLowerCase(),
				},
			}),
		});
		if (userData.status == 200) {
			return { status: 200, data: userData.data.data.results[0] };
		} else {
			return { status: 400, data: undefined };
		}
	}

	/**
	 * Update the Admin User in Strapi
	 */
	async updateAdminUserInStrapi(
		email: string,
		firstname: string,
		password = passwordGen.generate({
			length: 16,
			numbers: true,
			strict: true,
		}),
		role = 'Author',
		isActive = true
	): Promise<AdminResult> {

		const userData = await this.getAdminUserInStrapi(email.toLowerCase());

		if (userData) {
			const roleId = await this.getRoleId(role);
			const auth = {
				email: email.toLowerCase(),
				firstname,
				password,
				isActive,
				roles: [roleId],
			};

			return await this.serverManager.strapiAdminSendDatalayer({
				method: 'put',
				type: 'users',
				id: userData.data.id,
				data: auth,
			});
		} else {
			return { data: undefined, status: 400 };
		}
	}

    /**
     * Get all Admin Users in Strapi
     */
	async getAllAdminUserInStrapi(): Promise<AdminResult> {
		return await this.serverManager.strapiAdminSendDatalayer({
			method: 'get',
			type: 'users',
			id: undefined,
			action: undefined,
		});
	}

    /**
     * Delete an Admin User in Strapi
     */
	async deleteAdminUserInStrapi(email: string, role = 'Author'): Promise<AdminResult> {
		const user = await this.getAdminUserInStrapi(email);

		return await this.serverManager.strapiAdminSendDatalayer({
			method: 'delete',
			type: 'users',
			id: user.data.id,
		});
	}

	/**
	 * Helper Method to get the role id for the user based on Requested Role
	 * (e.g., Author, Editor, Admin, Super Admin)
	 */
	async getRoleId(requestedRole: string): Promise<number> {
		const response = await this.serverManager.executeStrapiAdminSend('get', 'roles');
		let idToReturn = -1;
		if (response) {
			const availableRoles = response.data.data as role[];
			const theRole = availableRoles?.filter((role) => role.name == requestedRole);
			idToReturn = theRole?.[0]?.id ?? -1;
		}
		return idToReturn;
	}
}

export default IamStrapiService;