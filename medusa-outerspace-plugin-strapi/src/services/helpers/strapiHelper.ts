import { BaseEntity } from '@medusajs/medusa';
import { sleep } from '@medusajs/medusa/dist/utils/sleep';
import axios, { AxiosResponse, Method, AxiosError } from 'axios';
import cloneDeep from 'lodash/cloneDeep';
import isArray from 'lodash/isArray';
import qs from 'qs';

// Custom Imports
import { LoggerHelper } from './loggerHelper';
import { StrapiServerManager, LoginTokenExpiredError } from './strapiServerManager';

import { 
    StrapiSendParams, 
    AuthInterface,
    userCreds as UserCreds, 
    StrapiMedusaPluginOptions,
} from '../../types/globals';

import {
	StrapiResult,
	StrapiGetResult,
	StrapiEntity,
	MedusaGetResult,
} from '../types/types';

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

/**
 * Strapi Helper class
 * 
 */
export class StrapiHelper {
    private strapi_url: string;
    private token: string;
	private options_: StrapiMedusaPluginOptions;
	private strapiSuperAdminAuthToken: string;

	// Helpers
	private loggerHelper: LoggerHelper;	
	private strapiServerManager: StrapiServerManager;

    /**
     * Default constructor
     * @param strapi_url
     * @param token
     */
    constructor(logger: any, strapi_url: string, token: string, options: StrapiMedusaPluginOptions) {
        this.strapi_url = strapi_url;
        this.token = token;
		this.strapiSuperAdminAuthToken = token;
		this.options_ = options;
		this.loggerHelper = new LoggerHelper(logger);
		this.strapiServerManager = new StrapiServerManager(logger, strapi_url, token, options);
    }

	getServer(): StrapiServerManager {
		return this.strapiServerManager;
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
                id: command.data.id,
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
            this.loggerHelper.log('info', e.message);
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
            const result = await this.getEntriesInStrapi({
                type: command.type,
                method: 'get',
                id: command.data.id,
                data: undefined,
                authInterface: command.authInterface,
                query: command.query,
            });
            this.loggerHelper.log('info', `LFE is here ${JSON.stringify(command)}`);

            const putResult = await this.processStrapiEntry({
                ...command,
                method: 'put',
                id: command.data.id,
                query: undefined,
            });
            this.loggerHelper.log('info', `LFE is here ${JSON.stringify(putResult)}`);
            return putResult;
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
		await this.strapiServerManager.waitForHealth();
		await this.strapiServerManager.waitForServiceAccountCreation();
		let tail = '';
		
		//	if (method.toLowerCase() != 'post') {
		if (method.toLowerCase() != 'post') {
			if (
				id &&
				id != '' &&
				id?.trim().toLocaleLowerCase() != 'me' &&
				type.toLowerCase() != 'users' &&
				method.toLowerCase() == 'get'
			) {
				tail = `?${this.appendIdToStrapiFilter(query, id)}`;
			} else {
				tail = id ? `/${id}` : '';
			}
			if (tail == '' && query) tail = `?${query}`;
		}
		//	}

		endPoint = `${this.strapi_url}/api/outerspace-strapi-plugin-medusa/${type}${tail}`;
		this.loggerHelper.log('info', `User endpoint: ${endPoint}`);
		const basicConfig = {
			method: method,
			url: endPoint,
			headers: {
				Authorization: `Bearer ${token}`,
			},
		};
		this.loggerHelper.log('info', `${basicConfig.method} ${basicConfig.url}`);
		const config = data
			? {
					...basicConfig,
					data,
			  }
			: {
					...basicConfig,
			  };

		try {
			this.loggerHelper.log('debug', `User Endpoint firing: ${endPoint} method: ${method} query:${query}`);
			const result = await axios(config);
			this.loggerHelper.log('debug', `User Endpoint fired: ${endPoint} method : ${method} query:${query}`);
			// console.log("attempting action:"+result);
			if (result.status >= 200 && result.status < 300) {
				this.loggerHelper.log(
					'debug',
					`Strapi Ok : method: ${method}, id:${id}, type:${type},` +
						` data:${JSON.stringify(data)}, :status:${result.status} query:${query}`
				);
			}

			return result;
		} catch (error) {
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
