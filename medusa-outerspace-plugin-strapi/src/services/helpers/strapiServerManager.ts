import axios, { AxiosResponse, Method, AxiosError } from 'axios';
import { sleep } from '@medusajs/medusa/dist/utils/sleep';
import isEmpty from 'lodash/isEmpty';

// Custom Imports
import { LoggerHelper } from './loggerHelper';
import { 
    StrapiSendParams, 
    StrapiMedusaPluginOptions, 
    StrapiAdminSendParams,
    MedusaUserType,
    userCreds as UserCreds, 
    AuthInterface, 
    AdminUserType, 
    Tokens } from '../../types/globals';

import { AdminResult} from '../types/types';

export interface LoginTokenExpiredErrorParams extends Partial<StrapiSendParams> {
	response?: { status: number };
	message?: string;
	error?: AxiosError;
	time?: Date;
}

export class LoginTokenExpiredError extends AxiosError {
	constructor(private readonly error: LoginTokenExpiredErrorParams) {
		super(error.message, '401', error.error.config, error.error.request, error.error.response);
	}
}

/**
 * Strapi Server Manager
 */
export class StrapiServerManager {

    private loggerHelper: LoggerHelper;
    private options: StrapiMedusaPluginOptions;
    private strapi_url: string;
	private userTokens: Tokens;
    private defaultUserEmail: string;
	private defaultUserPassword: string;

	private strapiSuperAdminAuthToken: string;
	private lastAdminLoginAttemptTime: number;
	private userAdminProfile: { email: string };

    static isHealthy: boolean = false;
	static lastHealthCheckTime = 0;
	static strapiRetryDelay: number = 180e3; // 180 seconds
	static isServiceAccountRegistered: boolean = false;

    /**
     * Constructor
     */
    constructor(logger: any, strapi_url: string, token: string, options: StrapiMedusaPluginOptions) {
        this.loggerHelper = new LoggerHelper(logger);
        this.options = options;
        this.defaultUserEmail = options.strapi_default_user.email;
		this.defaultUserPassword = options.strapi_default_user.password;
        this.strapi_url = strapi_url;
        this.userTokens = {};
        this.strapiSuperAdminAuthToken = token;

		// Check if the strapi server is healthy
		this.executeStrapiHealthCheck().then(
			async (res) => {
				if (res && this.options.auto_start) {
					StrapiServerManager.isHealthy = res;
					let startupStatus;

					try {
						const startUpResult = await this.startInterface();
						startupStatus = startUpResult.status < 300;
					} catch (error) {
						this.loggerHelper.log('error', error.message);
					}

					if (!startupStatus) {
						throw new Error('strapi startup error');
					}
				}
			}
		);
    }

    /**
     * Returns the Auth Interface
     */
    getAuthInterface() {
        let defaultAuthInterface = {
            email: this.defaultUserEmail,
            password: this.defaultUserPassword,
        }
        return defaultAuthInterface;
    }

    /**
     * Fetch User Token
     */
    fetchUserToken(email: string = this.getAuthInterface().email): string {
		const token = this.userTokens[email].token;
		if (token) {
			this.loggerHelper.log('info', 'fetched token for: ' + email);
		}
		return token;
	}

    /**
     * Delete User Token
     */
    deleteUserToken(email: string = this.getAuthInterface().email): void {
        delete this.userTokens[email];
    }

    /**
     * Retrieve a refreshed token
     * 
     */
    async retrieveRefreshedToken(authInterface: AuthInterface, errorCode?: string | number) {
        const { email } = authInterface;
        const currentTime = Date.now();
        const lastRetrived = this.userTokens[email.toLowerCase()];

        if (lastRetrived && errorCode != '401') {
            if (!StrapiServerManager.strapiRetryDelay) {
                StrapiServerManager.strapiRetryDelay = 180e3;
            }
            const diff = Math.floor(currentTime / 1000) - Math.floor((lastRetrived.time ?? 0) / 1000);
            if (diff < StrapiServerManager.strapiRetryDelay) {
                this.loggerHelper.log('debug', 'using cached user credentials ');
                return lastRetrived;
            }
        }
        try {
            const res = await this.executeLoginAsStrapiUser(authInterface);
            if (res?.data.jwt) {
                this.userTokens[email.toLowerCase()] = {
                    token: res.data.jwt /** caching the jwt token */,
                    time: Date.now(),
                    user: res.data.user,
                };
                this.loggerHelper.log('info', `${email} ` + 'successfully logged in to Strapi');
                return this.userTokens[email.toLowerCase()];
            }
        } catch (error) {
            this.loggerHelper.log('error', `${email} ` + 'error logging in in to Strapi');
            this.axiosError(error);
        }
    }

    /**
     * Execute Login as Strapi User
     */
    async executeLoginAsStrapiUser(
        authInterface: AuthInterface = this.getAuthInterface()
    ): Promise<AxiosResponse> {
        await this.waitForHealth();
        await this.waitForServiceAccountCreation();
        try {
            const authData = {
                identifier: authInterface.email.toLowerCase(),
                password: authInterface.password,
            };
            this.loggerHelper.log('info', `firing: ${this.strapi_url}/api/auth/local`);
            const response = await axios.post(`${this.strapi_url}/api/auth/local`, authData);
            return response;
        } catch (error) {
            this.axiosError(error, undefined, undefined, undefined, undefined, `${this.strapi_url}/api/auth/local`);
            throw new Error(
                `\n Error  ${authInterface.email} while trying to login to strapi\n` + (error as Error).message
            );
        }
    }

	/**
	 * Helper Method used to connect with the Strapi Admin Endpoint
	 * 
	 * Used by the following methods:
	 * 	- getRoleId()
	 * 	- strapiAdminSendDatalayer()
	 *	- registerSuperAdminUserInStrapi()
	 */
	 async executeStrapiAdminSend(method: Method,
		type: string,
		id?: string,
		action?: string,
		data?: any,
		query?: string
	): Promise<AxiosResponse | undefined> {

		// Login as super admin
		const result = await this.executeLoginAsStrapiSuperAdmin();
		if (!result) {
			this.loggerHelper.log('error', 'No user Bearer token, check axios request');
			return;
		}

		// Set the headers with a refresh token
		let headers = undefined;
		this.strapiSuperAdminAuthToken = result.data.token;
		if (this.strapiSuperAdminAuthToken) {
			headers = {
				Authorization: `Bearer ${this.strapiSuperAdminAuthToken}`,
				'Content-type': 'application/json',
			};
		}

		// Construct the request
		const path = [];
		const items = [type, action, id];
		for (const item of items) {
			if (item) {
				path.push(item);
			}
		}
		const q = query ? `?${query}` : '';
		const finalUrl = `${this.strapi_url}/admin/${path.join('/')}${q}`;
		const basicConfig = {
			method: method,
			url: finalUrl,
			headers,
		};

		this.loggerHelper.log('info', `Admin Endpoint fired: ${basicConfig.url}`);
		const config = data ? { ...basicConfig, data } : { ...basicConfig };

		try {
			const result = await axios(config);
			if (result.status >= 200 && result.status < 300) {
				this.loggerHelper.log('info', `Strapi Data : ${JSON.stringify(result.data)}`);
			} else {
				this.loggerHelper.log('info', 'Admin endpoint error occured', result);
			}
			return result;
		} catch (error) {
			this.axiosError(error, id, type, {}, method, basicConfig.url);
		}
	}

	/**
	 * Register the super admin user in Strapi
	 */
	async registerSuperAdminUserInStrapi(): Promise<any> {
		const auth: AdminUserType = {
			...this.options.strapi_admin,
		};
		try {
			const result = await this.executeStrapiAdminSend('post', 'register-admin', undefined, undefined, auth);
			return result.data?.user;
		} catch (e) {
			this.loggerHelper.log(
				'warn',
				`unable to register super user,` + ` super user may already registered, ${e.message}`
			);
		}
	}

    /**
     * Register Super Admin User in Strapi
     */
	async registerOrLoginAdmin(): Promise<{
		data: {
			user: any;
			token: string;
		};
	}> {
		try {
			await this.registerSuperAdminUserInStrapi();
		} catch (e) {
			this.loggerHelper.log('info', 'super admin already registered', e);
		}
		return await this.executeLoginAsStrapiSuperAdmin();
	}


    	/** *
	 * Send the command using elevated privileges
	 */
	async strapiAdminSendDatalayer(command: StrapiAdminSendParams): Promise<AdminResult> {
		const { method, type, id, action, data, query } = command;
		try {
			const result = await this.executeStrapiAdminSend(method, type, id, action, data, query);
			return { data: result.data, status: result.status };
		} catch (e) {
			this.loggerHelper.log('error', e.message);
			return { data: undefined, status: 400 };
		}
	}

    
	/**
	 * Registers the medusa user in strapi
	 */
	async executeRegisterMedusaUser(auth: MedusaUserType): Promise<AxiosResponse | undefined> {
		let response: AxiosResponse;

		try {
			response = await axios.post(`${this.strapi_url}/outerspace-strapi-plugin-medusa/create-medusa-user`, auth, {
				headers: {
					Authorization: `Bearer ${this.strapiSuperAdminAuthToken}`,
				},
				timeout: 3600e3 /** temp workaround to stop retransmissions over 900ms*/,
			});
		} catch (e) {
			this.loggerHelper.log('error', 'user registration error');
			this.axiosError(e);
		}
		return response;
	}

	/**
	 *
	 * @returns the default user  - service account for medusa requests
	 */
	async registerDefaultMedusaUser(): Promise<{ id: string }> {
		try {
			const authParams = {
				...this.options.strapi_default_user,
			};
			const registerResponse = await this.executeRegisterMedusaUser(authParams);
			StrapiServerManager.isServiceAccountRegistered = true;
			return registerResponse?.data;
		} catch (error) {
			this.loggerHelper.log('error', 'unable to register default user', { error: (error as Error).message });
		}
	}


	/**
	 * Login as the default medusa user
	 */
	async loginAsDefaultMedusaUser(): Promise<UserCreds> {
		let userCrds: UserCreds;
		try {
			userCrds = await this.strapiLoginSendDatalayer(this.getAuthInterface());

			this.loggerHelper.log('info', 'Default Medusa User Logged In');
		} catch (error) {
			if (!userCrds) {
				this.loggerHelper.log('error', 'Unable to login default medusa user: ' + (error as Error).message);
			}
		}
		return userCrds;
	}

        /**
     * Send data to Strapi with a token
     * 
     */
        async strapiLoginSendDatalayer(
            authInterface: AuthInterface = this.getAuthInterface()
        ): Promise<UserCreds> {
            const refreshedCredentials = await this.retrieveRefreshedToken(authInterface);
            return refreshedCredentials;
        }

        
	async registerOrLoginDefaultMedusaUser(): Promise<UserCreds> {
		try {
			await this.registerDefaultMedusaUser();
			this.loggerHelper.log('info', 'registered default user');
		} catch (e) {
			this.loggerHelper.log('info', 'default user already registered', e);
		}
		return await this.loginAsDefaultMedusaUser();
	}

	async executeLoginAsStrapiSuperAdmin(): Promise<{
		data: { user: any; token: string };
	}> {
		const auth = {
			email: this.options.strapi_admin.email,
			password: this.options.strapi_admin.password,
		};
		const currentLoginAttempt = Date.now();
		const timeDiff = Math.floor((currentLoginAttempt - (this.lastAdminLoginAttemptTime ?? 0)) / 1000);
		if (StrapiServerManager.strapiRetryDelay && timeDiff < StrapiServerManager.strapiRetryDelay && this.strapiSuperAdminAuthToken) {
			return {
				data: {
					user: this.userAdminProfile,
					token: this.strapiSuperAdminAuthToken,
				},
			};
		}
		this.lastAdminLoginAttemptTime = currentLoginAttempt;
		await this.waitForHealth();
		const adminUrl = `${this.strapi_url}/admin/login`;
		try {
			const response = await axios.post(adminUrl, auth, {
				headers: {
					'Content-Type': 'application/json',
				},
			});

			this.loggerHelper.log('info', 'Logged In   Admin ' + auth.email + ' with strapi');
			this.loggerHelper.log('info', 'Admin profile', response.data.data.user);
			//this.loggerHelper.log('info', 'Admin token', response.data.data.token);

			this.strapiSuperAdminAuthToken = response.data.data.token;
			this.userAdminProfile = response.data.data.user;
			return {
				data: {
					user: this.userAdminProfile,
					token: this.strapiSuperAdminAuthToken,
				},
			};
		} catch (error) {
			// Handle error.
			this.loggerHelper.log('info', 'An error occurred' + ' while logging into admin:');
			this.axiosError(error, undefined, undefined, undefined, undefined, `${this.strapi_url}/admin/login`);

			throw error;
		}
	}
	/**
	 * Initialize the Strapi Server
	 */
	async intializeServer(): Promise<any> {
		await this.registerOrLoginAdmin();
		if (this.strapiSuperAdminAuthToken) {
			const user = (await this.registerOrLoginDefaultMedusaUser()).user;
			if (!this.options.sync_on_init) {
				return { status: 200 };
			}
			if (user) {
				const response = await this.executeSync(this.strapiSuperAdminAuthToken);
				if (response.status < 300) {
					this.loggerHelper.log(
						'info',
						'medusa - strap -bootstrap confirmed ..please wait till sync completes'
					);
					return response;
				}
			} else {
				this.loggerHelper.log('error', 'unable to login default user');
			}
		} else {
			this.loggerHelper.log('error', 'unable to connect as super user');
		}
	}

    async executeSync(token: string): Promise<AxiosResponse> {
		await this.waitForHealth();
		try {
			const result = await axios.post(
				`${this.strapi_url}/outerspace-strapi-plugin-medusa/synchronise-medusa-tables`,
				{},
				{
					headers: {
						Authorization: `Bearer ${token}`,
					},
					timeout: 3600e3 /** temp workaround to stop retransmissions over 900ms*/,
				}
			);
			this.loggerHelper.log('info', 'successfully initiated two way sync strapi<-->medusa');
			return result;
		} catch (error) {
			this.axiosError(
				error,
				undefined,
				undefined,
				undefined,
				undefined,
				`${this.strapi_url}/outerspace-strapi-plugin-medusa/synchronise-medusa-tables`
			);
		}
	}
	

	/**
	 * Start the Strapi Interface
	 */
	async startInterface(): Promise<any> {
		try {
			const result = await this.intializeServer();
			this.loggerHelper.log('info', 'Successfully Bootstrapped the strapi server');
			StrapiServerManager.isServiceAccountRegistered = true;
			return result;
		} catch (e) {
			this.loggerHelper.log(
				'error',
				`Unable to  bootstrap the strapi server, 
        please check configuration , ${e}`
			);
			throw e;
		}
	}

    /**
     * Wait for Service Account Creation
	 * 
	 * This method is used to wait for the service account to be registered
	 * before proceeding with the login step
	 * 
	 * @TODO - the service account must not be registerd when starting the interface
	 * The service account is registered when starting the interface or when
	 * registering the default medusa user
     */
	async waitForServiceAccountCreation() {
		while (!StrapiServerManager.isServiceAccountRegistered) {
			await sleep(3000);
		}
	}

    /**
     * Wait for Strapi Health
     */
    async waitForHealth(): Promise<void> {
        while (true) {
            const health = await this.checkStrapiHealth();
            if (health) {
                break;
            }
            this.loggerHelper.log('debug', 'Awaiting Strapi Health');
            await sleep(1000);
        }
    }

	/**
	 * Checks if Strapi is healthy
	 */
	async checkStrapiHealth(): Promise<boolean> {

		const currentTime = Date.now();
		const timeInterval = this.options.strapi_healthcheck_timeout ?? 120e3; // 120 seconds
		const timeDifference = currentTime - (StrapiServerManager.lastHealthCheckTime ?? 0);
		const intervalElapsed = timeDifference > timeInterval;

		if (!StrapiServerManager.isHealthy) {
			/** clearing tokens if the health check fails dirty */
			this.userTokens = Object.assign(this.userTokens, {});
			this.strapiSuperAdminAuthToken = undefined;
		}

		const result =
			intervalElapsed || !StrapiServerManager.isHealthy
				? await this.executeStrapiHealthCheck()
				: StrapiServerManager.isHealthy; /** sending last known health status */
		return result;
	}

    /**
	 * Executes the real strapi request to check if Strapi is healthy
	 * #TODO - implent Promise.race() to handle timeout
	 */
	async executeStrapiHealthCheck(): Promise<boolean> {

		const config = { url: `${this.strapi_url}/_health`, };
		this.loggerHelper.log('info', `Checking Strapi Health `);

		try {
			let response = undefined;
			let timeOut = this.options.strapi_healthcheck_timeout ?? 120e3; // 120 seconds

			// Retrying the health check till the timeout (120 seconds)
			while (timeOut-- > 0) {
				try {
					response = await axios.head(config.url);
				} catch (e) {
					this.loggerHelper.log('error', `health check error ${e.message}`);
				}
				if (response && response?.status) {
					break;
				}
				this.loggerHelper.log('error', `response from the server: ${response?.status ?? 'no-response'}`);
				await sleep(3000); // 3 seconds
			}

			// Update the last health check time
			StrapiServerManager.lastHealthCheckTime = Date.now();

			if (response) {
				StrapiServerManager.isHealthy = response.status < 300 ? true : false;
				if (StrapiServerManager.isHealthy) {
					this.loggerHelper.log('info', 'Strapi is healthy');
				} else {
					this.loggerHelper.log('info', 'Strapi is unhealthy');
				}
			} else {
				StrapiServerManager.isHealthy = false;
			}

			return StrapiServerManager.isHealthy;

		} catch (error) {
			this.loggerHelper.log('error', 'Strapi health check failed');
			StrapiServerManager.isHealthy = false;
			return false;
		}
	}

    /**
     * Axios Error 
     */
    axiosError(error: AxiosError, id?: string, type?: string, data?: any, method?: Method, endPoint?: string): void {
		if (endPoint) {
			this.loggerHelper.log('info', `Endpoint Attempted: ${endPoint}`);
		}
		try {
			if (error?.response?.status != 200) {
				const errorCode = error?.response?.status ?? 'none';
				switch (errorCode) {
					case 401:
						throw new LoginTokenExpiredError({
							error,
							response: error.response,
							id,
							type,
							data,
							method,
							time: new Date(),
						});
					default:
						throw error;
				}
			}
		} catch (e) {
			if (e instanceof LoginTokenExpiredError) throw e;
			else this.handleError(error, id, type, data, method, endPoint);
		}
	}

    /**
     * Handle Error 
     */
    handleError(error: any, id?: string, type?: string, data?: any, method?: Method, endPoint?: string) {
		const theError = `${(error as Error).message} `;
		const responseData = isEmpty(data) ? {} : error?.response?.data ?? 'none';
		if (data) data.password = data?.password ? '#' : undefined;
		this.loggerHelper.log(
			'error',
			'Error occur while sending request to strapi:  ' +
				JSON.stringify({
					'error.message': theError,
					request: {
						url: endPoint || 'none',
						data: JSON.stringify(data) || 'none',
						method: method || 'none',
					},
					response: {
						body: JSON.stringify(responseData),
						status: error?.response?.status ?? 'none',
					},
				})
		);

		if (!endPoint?.includes('register-admin')) {
			this.loggerHelper.log(
				'error',
				`Error while trying ${method}` +
					`,${type ?? ''} -  ${id ? `id: ${id}` : ''}  ,
                }  entry in strapi ${theError}`
			);
			throw error;
		}
	}


}