import { BaseEntity, EventBusService } from '@medusajs/medusa';
import { Logger } from '@medusajs/medusa/dist/types/global';
import axios, { AxiosResponse, Method, AxiosError } from 'axios';
import cloneDeep from 'lodash/cloneDeep';
import isArray from 'lodash/isArray';
import qs from 'qs';

// Custom Imports
import { LoggerHelper } from './loggerHelper';
import { RedisHelper } from './redisHelper';
import { StrapiServerManager, LoginTokenExpiredError } from './strapiServerManager';

import { 
    StrapiSendParams, 
    StrapiMedusaPluginOptions,
} from '../../types/globals';

import {
	StrapiResult,
	StrapiGetResult,
	StrapiEntity,
	MedusaGetResult,
} from '../types/types';
import { log } from 'console';

export interface StrapiQueryInterface {
	fields: string[];
	filters: Record<string, unknown>;
	populate?: any;
	sort?: string[];
	pagination?: {
		pageSize: number;
		page: number;
	};
	publicationState?: string;
	locale?: string[];
}

export interface StrapiHelperInterface {
	logger: Logger;
	redisClient: any;
	eventBusService: EventBusService;
}

/**
 * Strapi Helper class
 * 
 */
export class StrapiHelper {
	private strapi_url: string;
	private options: StrapiMedusaPluginOptions;

	// Helpers
	private loggerHelper: LoggerHelper;	
	private strapiServerManager: StrapiServerManager;
	private redisHelper: RedisHelper;

    /**
     * Default constructor
     * @param strapi_url
     * @param token
     */
    constructor(
		props: StrapiHelperInterface,
		token: string,
		options: StrapiMedusaPluginOptions) {

        // Set the technical fields
		this.options = options;
		let strapi_protocol = this.options.strapi_protocol ?? 'https';
		let strapi_port = this.options.strapi_port ?? (strapi_protocol == 'https' ? undefined : 1337);
		this.strapi_url =
			`${strapi_protocol}://` +
			`${this.options.strapi_host ?? 'localhost'}` +
			`${strapi_port ? ':' + strapi_port : ''}`;

		this.options = options;
		this.loggerHelper = new LoggerHelper(props.logger);

		this.redisHelper = new RedisHelper(props.eventBusService, props.redisClient);
		this.strapiServerManager = new StrapiServerManager(props.logger, this.strapi_url, token, options);
    }

	getServer(): StrapiServerManager {
		return this.strapiServerManager;
	}
	
	getRedisHelper() {
		return this.redisHelper;
	}

	/**
	 * Check if the type exists in Strapi
	 */
	async checkType(type, authInterface): Promise<boolean> {
		let result: StrapiResult;
		try {
			result = result = await this.strapiSendDataLayer({
				method: 'get',
				type,
				authInterface,
			});
		} catch (error) {
			this.loggerHelper.log('error', `${type} type not found in strapi`);
			result = undefined;
		}
		return result ? true : false;
	}

    /**
     * Create a new entry in Strapi
     *
     */
    async createEntryInStrapi(command: StrapiSendParams): Promise<StrapiResult> {
        let result: StrapiGetResult;
		
		try {
            /** to check if the request field already exists */
            result = await this.getEntriesInStrapi({
                type: command.type,
                method: 'get',
                id: command.id || command.data.id,
                data: undefined,
                authInterface: command.authInterface,
            });

            if (result.data?.length > 0 && result.status == 200) {
                if (result.data[0]) {
                    return {
                        status: result.status == 200 ? 302 : 400,
                        data: result.data[0],
                    };
                }
            }
        } catch (e) {
            this.loggerHelper.log('error', e.message);
        }

        const createResponse = await this.processStrapiEntry({
            ...command,
            method: 'post',
        });

        return createResponse;
    }

    /**
     * Get all entries from Strapi
     *
     */
    async getEntriesInStrapi(command: StrapiSendParams): Promise<StrapiGetResult> {
        const result = await this.processStrapiEntry({
            ...command,
            method: 'get',
        });
        return {
            data: isArray(result.data) ? [...result.data] : [result.data],
            meta: result?.meta,
            status: result.status,
        };
    }

    /**
     * Update an entry in Strapi
     *
     */
    async updateEntryInStrapi(command: StrapiSendParams): Promise<StrapiResult> {
        try {
			let id = command.id || command.data.id;
			const ignore = await this.redisHelper.shouldIgnore(id, 'strapi');
			
			if (ignore) {
				return { status: 400 };
			}

			// Does the entity exist in Strapi?
            const result = await this.getEntriesInStrapi({
                type: command.type,
                method: 'GET',
                id: id,
                data: undefined,
                authInterface: command.authInterface,
                query: command.query,
            });
            // If it does, update it
			if (result) {
				const putResult = await this.processStrapiEntry({
					...command,
					method: 'PUT',
					id: id,
					query: undefined,
				});
				return putResult;
			}
        } catch (e) {
            this.loggerHelper.log(
                'error',
                `entity doesn't exist in strapi :${e.message} : ${command.id}` + ' , update not possible'
            );
        }
    }

    /**
     * Delete an entry in Strapi
     *
     */
    async deleteEntryInStrapi(command: StrapiSendParams): Promise<StrapiResult> {
		
		let id = command.id || command.data.id;
		const ignore = await this.redisHelper.shouldIgnore(id, 'strapi');
		
		if (ignore) {
			return { status: 400 };
		}
		return await this.processStrapiEntry({
            ...command,
            method: 'delete',
        });
    }

    /**
     *  Send data to Strapi
     * @ TODO : to remove calling strapiSendDataLayer directly
     *
     */
    async processStrapiEntry(command: StrapiSendParams): Promise<StrapiResult> {
        try {
            const result = await this.strapiSendDataLayer(command);
            return result;
        } catch (e) {
            this.loggerHelper.log('error', 'Unable to process strapi entry request: ' + e.message);
            return { status: 400, data: undefined };
        }
    }

    /**
     * Send data to Strapi
     * using cached tokens 
     * @todo enable api based access
     * automatically converts "id" into medusa "id"
     */
    async strapiSendDataLayer(params: StrapiSendParams): Promise<StrapiResult> {
        const { method, type, id, data, authInterface, query } = params;
        const userCreds = await this.strapiServerManager.strapiLoginSendDatalayer(authInterface);

        if (!userCreds) {
            this.loggerHelper.log('error', `no such user:${authInterface.email}`);
            return { status: 400 };
        }

        let dataToSend: BaseEntity & { medusa_id?: string };

        if (data && data.id) {
            dataToSend = cloneDeep(data);
            dataToSend = this.translateDataToStrapiFormat(dataToSend);
        } else {
            dataToSend = data;
        }

        try {
            const result = await this.executeStrapiSend({
                method,
                type,
                token: userCreds.token,
                id,
                data: dataToSend,
                query,
            });
            return {
                id: result.data.id ?? result.data.data?.id,
                medusa_id: result.data.medusa_id ?? result.data.data?.medusa_id,
                status: result.status,
                data: result.data.data ?? result.data,
                query,
            };
        } catch (e) {
            if (e instanceof LoginTokenExpiredError) {
                await this.strapiServerManager.retrieveRefreshedToken(authInterface, '401');
                return await this.strapiSendDataLayer(params);
            }
            if (e instanceof AxiosError) {
                if (method.toLowerCase() == 'get' && e.response.status == 404) {
                    this.loggerHelper.log(
                        'error',
                        `unable to find ${type} id: ${id ?? ''} query:${query ?? ''} message: ${e.message}`,
                        params
                    );
                    return {
                        id: undefined,
                        medusa_id: undefined,
                        status: e.response.status,
                        data: undefined,
                        query,
                    };
                } else {
                    this.strapiServerManager.axiosError(e, id, type, data, method);
                }
            }

            this.loggerHelper.log('error', e.message);
            return { status: 400 };
        }
    }

    /**
     * Execute a strapi send
     * 
     */
    async executeStrapiSend({
		method,
		type,
		token,
		id,
		data,
		query,
	}: {
		method: Method;
		type: string;
		token: string;
		id?: string;
		data?: any;
		query?: string;
	}): Promise<AxiosResponse> {

		let endPoint: string = undefined;
		let tail = '';

		await this.strapiServerManager.waitForHealth();
		await this.strapiServerManager.waitForServiceAccountCreation();

		// If the method is not POST, we need to append the id to the endpoint
		if (method.toLowerCase() != 'post') {
			// GET
			if ( id && id != '' && id?.trim().toLocaleLowerCase() != 'me' &&
				type.toLowerCase() != 'users' && method.toLowerCase() == 'get'
			) {  
				tail = `?${this.appendIdToStrapiFilter(query, id)}`; 
			} else { // PUT or DELETE
				tail = id ? `/${id}` : ''; }
			if (tail == '' && query) tail = `?${query}`;
		}

		// Construct the endpoint
		endPoint = `${this.strapi_url}/api/outerspace-strapi-plugin-medusa/${type}${tail}`;

		const basicConfig = {
			method: method,
			url: endPoint,
			headers: {
				Authorization: `Bearer ${token}`,
			},
		};

		const config = data
			? { ...basicConfig, data }
			: { ...basicConfig };

		try {
			// Call the endpoint with the config
			const result = await axios(config);
			if (result.status >= 200 && result.status < 300) {
				this.loggerHelper.log(
					'debug',
					`Strapi Ok : method: ${method}, id:${id}, type:${type},` +
						` data:${JSON.stringify(data)}, :status:${result.status} query:${query}`
				);
			}
			return result;
		} catch (error) {
			this.loggerHelper.log(
				'error',
				`Strapi Error : method: ${method}, id:${id}, type:${type},` +
					` data:${JSON.stringify(data)}, :status:${error.response.status} query:${query}`
			);
			this.strapiServerManager.axiosError(error, id, type, data, method, endPoint);
		}
	}

    /**
     * Check if the data represents an entity
     * 
     */
    private isEntity(data: any): boolean {
		return data instanceof Object && ('id' in data || 'medusa_id' in data);
	}

    /**
     * 
     * 
     */
    private appendIdToStrapiFilter(query: string, id?: string): string {
		const urlQuery = qs.parse(query) as any;
		const idFromUrlParams = urlQuery?.filters?.id;
		const medusaIdFromUrlParams = urlQuery?.fitlers?.medusa_id;
		if ((idFromUrlParams || medusaIdFromUrlParams) && id) {
			throw new Error('Multiple Ids in the Request');
		}
		id = id ?? medusaIdFromUrlParams ?? idFromUrlParams;
		const originalFilters = urlQuery.filters;
		const newFilters = id
			? {
					...originalFilters,
					medusa_id: id,
			  }
			: undefined;
		urlQuery.filters = newFilters;
		return qs.stringify(urlQuery);
	}

    /**
     *
     * Medusa is using underscores to represent relations between entities, strapi is using dashes.
	 * This library is translating it in some places but omitting others, this method is providing automatic translation
	 * on every sent request.
     */
	private translateRelationNamesToStrapiFormat(dataToSend: StrapiEntity, key: string): StrapiEntity {
		let testObject = null;

		if (isArray(dataToSend[key])) {
			if (dataToSend[key].length > 0) {
				testObject = dataToSend[key][0];
			}
		} else {
			testObject = dataToSend[key];
		}

		// if the object is a not empty array or object without id or medusa_id, it's not relation
		if (testObject && !this.isEntity(testObject)) {
			return dataToSend;
		}

		if (key.includes('-')) {
			dataToSend[key.replace('-', '_')] = dataToSend[key];
			delete dataToSend[key];
		}

		return dataToSend;
	}

    /**
     * Translate data to Strapi format
     * 
     */
	private translateDataToStrapiFormat(dataToSend: StrapiEntity): StrapiEntity {
		const keys = Object.keys(dataToSend);
		const keysToIgnore = ['id', 'created_at', 'updated_at', 'deleted_at'];

		for (const key of keys) {
			if (isArray(dataToSend[key])) {
				for (const element of dataToSend[key]) {
					this.isEntity(element) && this.translateDataToStrapiFormat(element);
				}
				this.translateRelationNamesToStrapiFormat(dataToSend, key);
			}

			if (dataToSend[key] instanceof Object && this.isEntity(dataToSend[key])) {
				this.translateDataToStrapiFormat(dataToSend[key]);
				this.translateRelationNamesToStrapiFormat(dataToSend, key);
			} else if (key == 'id') {
				dataToSend['medusa_id'] = dataToSend[key];
			}

			if (this.isEntity(dataToSend) && keysToIgnore.includes(key)) {
				delete dataToSend[key];
			}
		}
		return dataToSend as BaseEntity & { medusa_id?: string };
	}

    /**
     * Translate data to Medusa format
     * 
     */
    translateDataToMedusaFormat(dataReceived: StrapiGetResult): MedusaGetResult<typeof dataReceived.data> {
		const keys = Object.keys(dataReceived);
		const keysToIgnore = ['id', 'created_at', 'updated_at', 'deleted_at'];

		for (const key of keys) {
			if (isArray(dataReceived[key])) {
				for (const element of dataReceived[key]) {
					this.isEntity(element) && this.translateDataToStrapiFormat(element);
				}
				this.translateRelationNamesToMedusaFormat(dataReceived, key);
			}

			if (dataReceived[key] instanceof Object && this.isEntity(dataReceived[key])) {
				this.translateDataToStrapiFormat(dataReceived[key]);
				this.translateRelationNamesToMedusaFormat(dataReceived, key);
			} else if (key == 'medusa_id') {
				dataReceived['id'] = dataReceived[key];
			}

			if (this.isEntity(dataReceived) && keysToIgnore.includes(key)) {
				delete dataReceived[key];
			}
		}
		return dataReceived as MedusaGetResult<typeof dataReceived.data>;
	}

    /**
     * Translate Relation Names to Medusa Format 
     *
     */
    private translateRelationNamesToMedusaFormat(dataReceived: StrapiGetResult, key: string): StrapiGetResult {
		let testObject = null;

		if (isArray(dataReceived[key])) {
			if (dataReceived[key].length > 0) {
				testObject = dataReceived[key][0];
			}
		} else {
			testObject = dataReceived[key];
		}

		// if the object is a not empty array or object without id or medusa_id, it's not relation
		if (testObject && !this.isEntity(testObject)) {
			return dataReceived;
		}

		if (key.includes('_') && key != 'medusa_id') {
			dataReceived[key.replace('_', '-')] = dataReceived[key];
			delete dataReceived[key];
		}

		return dataReceived;
	}

	/**
	 * This function allows you to create a strapi query
	 */
	createStrapiRestQuery(strapiQuery: StrapiQueryInterface): string {
		const { sort, filters, populate, fields, pagination, publicationState, locale } = strapiQuery;

		const query = qs.stringify(
			{
				sort,
				filters,
				populate,
				fields,
				pagination,
				publicationState,
				locale,
			},
			{
				encodeValuesOnly: true, // prettify URL
			}
		);
		return query;
	}
}

export default StrapiHelper;
