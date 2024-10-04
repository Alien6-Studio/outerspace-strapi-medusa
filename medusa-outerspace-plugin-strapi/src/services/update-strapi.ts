'use strict';

import { Logger } from '@medusajs/medusa/dist/types/global';
import qs from 'qs';
import { EntityManager } from 'typeorm';

import cloneDeep from 'lodash/cloneDeep';
import isEmpty from 'lodash/isEmpty';

import {
	BaseEntity,
	EventBusService,
	Product,
	ProductCollectionService,
	ProductService,
	ProductTypeService,
	ProductVariantService,
	RegionService,
	TransactionBaseService,
	ProductCategoryService,
	ProductVariant,
} from '@medusajs/medusa';

// Custom imports
import { LoggerHelper } from './helpers/loggerHelper';
import { StrapiHelper }	from './helpers/strapiHelper';
import { RedisHelper } from './helpers/redisHelper';
import { StrapiServerManager } from './helpers/strapiServerManager';

import { StrapiResult, StrapiGetResult } from './types/types';

import {
	StrapiMedusaPluginOptions,
	StrapiSendParams,
	AuthInterface,
	CreateInStrapiParams,
	GetFromStrapiParams
} from '../types/globals';


/**
 * Parameters for the UpdateStrapiService
 */
export interface UpdateStrapiServiceParams {
	manager: EntityManager;
	regionService: RegionService;
	productService: ProductService;
	redisClient: any;
	productVariantService: ProductVariantService;
	productTypeService: ProductTypeService;
	eventBusService: EventBusService;
	productCollectionService: ProductCollectionService;
	productCategoryService: ProductCategoryService;
	logger: Logger;
}

/**
 * Service to update Strapi with Medusa data
 */
export class UpdateStrapiService extends TransactionBaseService {

	// Technical fields
	strapi_protocol: string;
	strapi_url: string;
	strapi_port: number;
	strapiSuperAdminAuthToken: string;
	options_: StrapiMedusaPluginOptions;
	key: WithImplicitCoercion<ArrayBuffer | SharedArrayBuffer>;

	// Managers
	protected manager_: EntityManager;
	protected transactionManager_: EntityManager;

	// Services
	productCollectionService: ProductCollectionService;
	productCategoryService: any;
	productService_: ProductService;
	productVariantService_: ProductVariantService;
	productTypeService_: ProductTypeService;
	regionService_: RegionService;

	// Helpers
	strapiHelper: StrapiHelper;
	redisHelper: RedisHelper;
	loggerHelper: LoggerHelper;

	/**
	 * Constructor
	 */
	constructor(container: UpdateStrapiServiceParams, options: StrapiMedusaPluginOptions) {
		super(container);

		// Set the logger
		this.loggerHelper = new LoggerHelper(container.logger);

		// Set the services
		this.productService_ = container.productService;
		this.productVariantService_ = container.productVariantService;
		this.productTypeService_ = container.productTypeService;
		this.regionService_ = container.regionService;
		this.productCollectionService = container.productCollectionService;
		this.productCategoryService = container.productCategoryService;

		// Set the technical fields
		this.options_ = options;
		this.strapi_protocol = this.options_.strapi_protocol ?? 'https';
		this.strapi_port = this.options_.strapi_port ?? (this.strapi_protocol == 'https' ? undefined : 1337);
		this.strapi_url =
			`${this.strapi_protocol}://` +
			`${this.options_.strapi_host ?? 'localhost'}` +
			`${this.strapi_port ? ':' + this.strapi_port : ''}`;


		// Set the helpers
		this.redisHelper = new RedisHelper(container.eventBusService, container.redisClient);
		this.strapiHelper = new StrapiHelper(container.logger, this.strapi_url, this.strapiSuperAdminAuthToken, options);

		// Check if the strapi server is healthy
		this.strapiHelper.getServer().executeStrapiHealthCheck().then(
			async (res) => {
				if (res && this.options_.auto_start) {
					StrapiServerManager.isHealthy = res;
					let startupStatus;

					try {
						const startUpResult = await this.strapiHelper.getServer().startInterface();
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

	getAuthInterface(): AuthInterface {
		return this.strapiHelper.getServer().getAuthInterface();
	}

	/**
	 * Clone the service with a transaction manager
	 */
	withTransaction(transactionManager?: EntityManager): this {
		if (!transactionManager) {
			return this;
		}
		const cloned = new UpdateStrapiService(
			{
				logger: this.loggerHelper.getLogger(),
				manager: transactionManager,
				productService: this.productService_,
				productVariantService: this.productVariantService_,
				productTypeService: this.productTypeService_,
				regionService: this.regionService_,
				eventBusService: this.redisHelper.getEventBus(),
				redisClient: this.redisHelper.getRedisClient(),
				productCollectionService: this.productCollectionService,
				productCategoryService: this.productCategoryService,
			},
			this.options_
		);

		this.transactionManager_ = transactionManager;
		return cloned as this;
	}



	async getVariantEntries_(variants, authInterface: AuthInterface): Promise<StrapiResult> {
		// eslint-disable-next-line no-useless-catch
		try {
			return { status: 400 };
		} catch (error) {
			throw error;
		}
	}

	async createImageAssets(product: Product, authInterface: AuthInterface): Promise<StrapiResult> {
		const assets = await Promise.all(
			product.images
				?.filter((image) => image.url !== product.thumbnail)
				.map(async (image) => {
					const result = await this.strapiHelper.createEntryInStrapi({
						type: 'images',
						id: product.id,
						authInterface,
						data: image,
						method: 'post',
					});
					return result;
				})
		);
		return assets ? { status: 200, data: assets } : { status: 400 };
	}

	getCustomField(field, type): string {
		const customOptions = this.options_[`custom_${type}_fields`];

		if (customOptions) {
			return customOptions[field] || field;
		} else {
			return field;
		}
	}

	async createEntityInStrapi<T extends BaseEntity>(params: CreateInStrapiParams<T>): Promise<StrapiResult> {
		await this.checkType(params.strapiEntityType, params.authInterface);
		const entity = await params.medusaService.retrieve(params.id, {
			select: params.selectFields,
			relations: params.relations,
		});
		if (entity) {
			const result = await this.strapiHelper.createEntryInStrapi({
				type: params.strapiEntityType,
				authInterface: params.authInterface,
				data: entity,
				method: 'POST',
			});
			return result;
		}
	}

	async getEntitiesFromStrapi(params: GetFromStrapiParams): Promise<StrapiGetResult> {
		await this.checkType(params.strapiEntityType, params.authInterface);

		const getEntityParams: StrapiSendParams = {
			type: params.strapiEntityType,
			authInterface: params.authInterface,
			method: 'GET',
			id: params.id,
			query: params.urlQuery
				? qs.stringify(params.urlQuery)
				: params.id
				? undefined
				: qs.stringify({
						fields: ['id', 'medusa_id'],
						populate: '*',
				  }),
		};
		try {
			const result = await this.strapiHelper.getEntriesInStrapi(getEntityParams);
			return {
				data: result?.data,
				status: result.status,
				meta: result?.meta,
			};
		} catch (e) {
			this.loggerHelper.log(
				'error',
				`Unable to retrieve ${params.strapiEntityType}, ${params.id ?? 'any'}`,
				getEntityParams
			);
			return { data: undefined, status: 404, meta: undefined };
		}
	}

	async createProductTypeInStrapi(productTypeId: string, authInterface: AuthInterface): Promise<StrapiResult> {
		return await this.createEntityInStrapi({
			id: productTypeId,
			authInterface: authInterface,

			strapiEntityType: 'product-types',
			medusaService: this.productTypeService_,
			selectFields: ['id', 'value'],
			relations: [],
		});
	}

	async createProductInStrapi(productId, authInterface: AuthInterface): Promise<StrapiResult> {
		try {
			const product = await this.productService_.retrieve(productId, {
				relations: [
					'options',
					'variants',
					'variants.prices',
					'variants.options',
					'type',
					'collection',
					'categories',
					'tags',
					'images',
				],
			});

			/**
			 * Todo implement schema validator
			 */
			if (product) {
				const productToSend = cloneDeep(product);
				productToSend['product_type'] = cloneDeep(productToSend.type);
				delete productToSend.type;
				productToSend['product_tags'] = cloneDeep(productToSend.tags);
				delete productToSend.tags;
				productToSend['product_options'] = cloneDeep(productToSend.options);
				delete productToSend.options;
				productToSend['product_variants'] = cloneDeep(productToSend.variants);
				delete productToSend.variants;

				productToSend['product_collection'] = cloneDeep(productToSend.collection);
				delete productToSend.collection;

				productToSend['product_categories'] = cloneDeep(productToSend.categories);
				delete productToSend.categories;
				this.loggerHelper.log('info', `creating product in strapi - ${JSON.stringify(productToSend)}`);
				const result = await this.strapiHelper.createEntryInStrapi({
					type: 'products',
					authInterface,
					data: productToSend,
					method: 'POST',
				});
				return result;
			}
		} catch (error) {
			throw error;
		}
	}

	async updateCollectionInStrapi(data, authInterface: AuthInterface): Promise<StrapiResult> {
		const updateFields = ['handle', 'title'];

		// Update came directly from product collection service so only act on a couple
		// of fields. When the update comes from the product we want to ensure
		// references are set up correctly so we run through everything.
		if (data.fields) {
			const found =
				data.fields.find((f) => updateFields.includes(f)) || this.verifyDataContainsFields(data, updateFields);
			if (!found) {
				return { status: 400 };
			}
		}

		try {
			const ignore = await this.redisHelper.shouldIgnore(data.id, 'strapi');
			if (ignore) {
				return { status: 400 };
			}

			const collection = await this.productCollectionService.retrieve(data.id, {
				relations: ['products'],
			});

			if (collection) {
				// Update entry in Strapi
				const response = await this.strapiHelper.updateEntryInStrapi({
					type: 'product-collections',
					id: collection.id,
					authInterface,
					data: { ...collection, ...data},
					method: 'put',
				});
				this.loggerHelper.log('info', `Successfully updated collection ${collection.id} in Strapi`, {
					'response.status': response.status,
					'response.data': response.data,
					'entity.id': collection.id,
				});
				return response;
			}

			return { status: 400 };
		} catch (error) {
			this.loggerHelper.log('info', 'Failed to update product collection', {
				'entity.id': data.id,
				'error.message': error.message,
			});
			return { status: 400 };
		}
	}

	async createCollectionInStrapi(collectionId: string, authInterface: AuthInterface): Promise<StrapiResult> {
		try {
			const collection = await this.productCollectionService.retrieve(collectionId);

			// this.loggerHelper.log("info",variant)
			if (collection) {
				const collectionToSend = cloneDeep(collection);

				const result = await this.strapiHelper.createEntryInStrapi({
					type: 'product-collections',
					id: collectionId,
					authInterface,
					data: collectionToSend,
					method: 'POST',
				});
				return result;
			}
		} catch (error) {
			this.loggerHelper.log('error', `unable to create collection ${collectionId} ${error.message}`);
		}
	}

	async updateCategoryInStrapi(data, authInterface: AuthInterface): Promise<StrapiResult> {
		const updateFields = ['handle', 'name'];

		// Update came directly from product category service so only act on a couple
		// of fields. When the update comes from the product we want to ensure
		// references are set up correctly so we run through everything.
		if (data.fields) {
			const found =
				data.fields.find((f) => updateFields.includes(f)) || this.verifyDataContainsFields(data, updateFields);
			if (!found) {
				return { status: 400 };
			}
		}

		try {
			const ignore = await this.redisHelper.shouldIgnore(data.id, 'strapi');
			if (ignore) {
				return { status: 400 };
			}

			const category = await this.productCategoryService.retrieve(data.id);

			if (category) {
				// Update entry in Strapi
				const response = await this.strapiHelper.updateEntryInStrapi({
					type: 'product-categories',
					id: category.id,
					authInterface,
					data: { ...category, ...data },
					method: 'put',
				});
				this.loggerHelper.log('info', `Successfully updated category ${category.id} in Strapi`, {
					'response.status': response.status,
					'response.data': response.data,
					'entity.id': category.id,
				});
				return response;
			}

			return { status: 400 };
		} catch (error) {
			this.loggerHelper.log('info', 'Failed to update product category', {
				'entity.id': data.id,
				'error.message': error.message,
			});
			return { status: 400 };
		}
	}

	async createCategoryInStrapi(categoryId: string, authInterface: AuthInterface): Promise<StrapiResult> {
		try {
			const category = await this.productCategoryService.retrieve(categoryId);

			if (category) {
				const categoryToSend = cloneDeep(category);

				const result = await this.strapiHelper.createEntryInStrapi({
					type: 'product-categories',
					id: categoryId,
					authInterface,
					data: categoryToSend,
					method: 'POST',
				});
				return result;
			}
		} catch (error) {
			this.loggerHelper.log('error', `unable to create category ${categoryId} ${error.message}`);
		}
	}

	async createProductVariantInStrapi(variantId, authInterface: AuthInterface): Promise<StrapiResult> {
		// eslint-disable-next-line no-useless-catch
		try {
			const variant = await this.productVariantService_.retrieve(variantId, {
				relations: ['prices', 'options', 'product'],
			});

			if (variant) {
				const variantToSend = cloneDeep(variant);
				variantToSend['money_amount'] = cloneDeep(variantToSend.prices);
				delete variantToSend.prices;

				variantToSend['product_option_value'] = cloneDeep(variantToSend.options);

				return await this.strapiHelper.createEntryInStrapi({
					type: 'product-variants',
					id: variantId,
					authInterface,
					data: variantToSend,
					method: 'POST',
				});
			}
		} catch (error) {
			throw error;
		}
	}

	convertOptionValueToMedusaReference(data): Record<string, any> {
		const keys = Object.keys(data);
		for (const key of keys) {
			if (key != 'medusa_id' && key.includes('_id')) {
				const medusaService = key.split('_')[0];
				const fieldName = `product_${medusaService}`;
				const value = data[key];

				data[fieldName] = {
					medusa_id: value,
				};
			}
		}
		return data;
	}

	async createRegionInStrapi(regionId, authInterface: AuthInterface): Promise<StrapiResult> {
		try {
			const region = await this.regionService_.retrieve(regionId, {
				relations: ['payment_providers', 'fulfillment_providers', 'currency'],
				select: ['id', 'name', 'tax_rate', 'tax_code', 'metadata'],
			});

			return await this.strapiHelper.createEntryInStrapi({
				type: 'regions',
				id: regionId,
				authInterface,
				data: region,
				method: 'post',
			});
		} catch (error) {
			throw error;
		}
	}

	async updateRegionInStrapi(data, authInterface: AuthInterface = this.getAuthInterface()): Promise<StrapiResult> {
		const updateFields = ['name', 'currency_code', 'countries', 'payment_providers', 'fulfillment_providers'];

		// check if update contains any fields in Strapi to minimize runs
		const found = this.verifyDataContainsFields(data, updateFields);
		if (!found) {
			return { status: 400 };
		}

		// eslint-disable-next-line no-useless-catch
		try {
			const ignore = await this.redisHelper.shouldIgnore(data.id, 'strapi');
			if (ignore) {
				return { status: 400 };
			}

			const region = await this.regionService_.retrieve(data.id, {
				relations: ['countries', 'payment_providers', 'fulfillment_providers', 'currency'],
				select: ['id', 'name', 'tax_rate', 'tax_code', 'metadata'],
			});

			if (region) {
				// Update entry in Strapi
				const response = await this.strapiHelper.updateEntryInStrapi({
					type: 'regions',
					id: region.id,
					authInterface,
					data: { ...region, ...data },
				});
				this.loggerHelper.log('info', 'Region Strapi Id - ', response);
				return response;
			} else {
				return { status: 400 };
			}
		} catch (error) {
			return { status: 400 };
			throw error;
		}
	}
	/**
	 * Product metafields id is the same as product id
	 * @param data
	 * @param authInterface
	 * @returns
	 */

	async createProductMetafieldInStrapi(
		data: { id: string; value: Record<string, unknown> },
		authInterface: AuthInterface =this.getAuthInterface()
	): Promise<StrapiResult> {
		const typeExists = await this.checkType('product-metafields', authInterface);
		if (!typeExists) {
			return { status: 400 };
		}

		const productInfo = await this.productService_.retrieve(data.id);
		const dataToInsert: BaseEntity = {
			...cloneDeep(data),
			created_at: productInfo.created_at,
			updated_at: productInfo.updated_at,
		};

		return await this.strapiHelper.createEntryInStrapi({
			type: 'product-metafields',
			id: data.id,
			authInterface,
			data: dataToInsert,
			method: 'post',
		});
	}

	async updateProductMetafieldInStrapi(
		data: { id: string; value: Record<string, unknown> },
		authInterface: AuthInterface
	): Promise<StrapiResult> {
		const typeExists = await this.checkType('product-metafields', authInterface);
		if (!typeExists) {
			return { status: 400 };
		}

		const productInfo = await this.productService_.retrieve(data.id);
		const dataToUpdate: BaseEntity & { medusa_id: string } = {
			...cloneDeep(data),
			created_at: productInfo.created_at,
			updated_at: productInfo.updated_at,
			medusa_id: data.id.toString(),
		};
		delete dataToUpdate.id;
		return await this.strapiHelper.updateEntryInStrapi({
			type: 'product-metafields',
			id: data.id,
			authInterface,
			data: { ...productInfo, ...dataToUpdate },
			method: 'put',
		});
	}

	async updateProductsWithinCollectionInStrapi(
		data,
		authInterface: AuthInterface = this.getAuthInterface()
	): Promise<StrapiResult> {
		const updateFields = ['productIds', 'productCollection'];

		if (!this.verifyDataContainsFields(data, updateFields)) {
			return { status: 400 };
		}
		try {
			for (const productId of data.productIds) {
				const ignore = await this.redisHelper.shouldIgnore(productId, 'strapi');
				if (ignore) {
					this.loggerHelper.log(
						'info',
						'Strapi has just added this product to collection which triggered this function. IGNORING... '
					);
					continue;
				}

				const product = await this.productService_.retrieve(productId, {
					relations: ['collection'],
					select: ['id'],
				});

				if (product) {
					// we're sending requests sequentially as the Strapi is having problems with deadlocks otherwise
					await this.adjustProductAndUpdateInStrapi(product, data, authInterface);
				}
			}
			return { status: 200 };
		} catch (error) {
			this.loggerHelper.log('error', 'Error updating products in collection', error);
			throw error;
		}
		return { status: 400 };
	}

	async updateProductsWithinCategoryInStrapi(
		data,
		authInterface: AuthInterface = this.getAuthInterface()
	): Promise<StrapiResult> {

		const updateFields = ['productIds', 'productCategories'];

		if (!this.verifyDataContainsFields(data, updateFields)) {
			return { status: 400 };
		}
		try {
			for (const productId of data.productIds) {
				const ignore = await this.redisHelper.shouldIgnore(productId, 'strapi');
				if (ignore) {
					this.loggerHelper.log(
						'info',
						'Strapi has just added this product to category which triggered this function. IGNORING... '
					);
					continue;
				}

				const product = await this.productService_.retrieve(productId, {
					relations: ['category'],
					select: ['id'],
				});

				if (product) {
					// we're sending requests sequentially as the Strapi is having problems with deadlocks otherwise
					await this.adjustProductAndUpdateInStrapi(product, data, authInterface);
				}
			}
			return { status: 200 };
		} catch (error) {
			this.loggerHelper.log('error', 'Error updating products in category', error);
			throw error;
		}
		return { status: 400 };
	}

	async updateProductInStrapi(
		data: Partial<Product>,
		authInterface: AuthInterface = this.getAuthInterface()
	): Promise<StrapiResult> {
		const updateFields = [
			'variants',
			'options',
			'tags',
			'title',
			'subtitle',
			'tags',
			'type',
			'type_id',
			'collection',
			'collection_id',
			'categories',
			'thumbnail',
			'height',
			'weight',
			'width',
			'length',
		];

		// check if update contains any fields in Strapi to minimize runs
		const found = this.verifyDataContainsFields(data, updateFields);
		if (!found) {
			return { status: 400 };
		}

		// eslint-disable-next-line no-useless-catch
		try {
			const ignore = await this.redisHelper.shouldIgnore(data.id, 'strapi');
			if (ignore) {
				this.loggerHelper.log(
					'info',
					'Strapi has just updated this product' + ' which triggered this function. IGNORING... '
				);
				return { status: 400 };
			}
			try {
				const product = await this.productService_.retrieve(data.id, {
					relations: [
						'options',
						'variants',
						'variants.prices',
						'variants.options',
						'type',
						'collection',
						'categories',
						'tags',
						'images',
					],
				});

				if (product) {
					try {
						const result = await this.adjustProductAndUpdateInStrapi(product, data, authInterface);
						if (result.status == 200) {
							return result;
						} else {
							await this.createProductInStrapi(data.id, authInterface);
							const result = await this.adjustProductAndUpdateInStrapi(product, data, authInterface);
							return result;
						}
					} catch (e) {
						this.loggerHelper.log('error', 'unable to update product', e.message);
						return { status: 400 };
					}
				} else {
					try {
						this.loggerHelper.log('info', "update failed as product doesn't exist, creating product instead");
						return await this.createProductInStrapi(data.id, authInterface);
					} catch (f) {
						return { status: 400 };
					}
				}
			} catch (e) {
				try {
					this.loggerHelper.log('error', "update failed as product doesn't exist, creating product instead");
					return await this.createProductInStrapi(data.id, authInterface);
				} catch (f) {
					return { status: 400 };
				}
			}
		} catch (error) {
			throw error;
		}
	}

	private async adjustProductAndUpdateInStrapi(
		product: Product,
		data: Partial<Product>,
		authInterface: AuthInterface
	) {
		// Medusa is not using consistent naming for product-*.
		// We have to adjust it manually. For example: collection to product-collection
		const dataToUpdate = { ...product, ...data };

		const keysToUpdate = ['collection', 'categories', 'type', 'tags', 'variants', 'options'];
		for (const key of keysToUpdate) {
			if (key in dataToUpdate) {
				dataToUpdate[`product_${key}`] = dataToUpdate[key];
				delete dataToUpdate[key];
			}
		}

		const response = await this.strapiHelper.updateEntryInStrapi({
			type: 'products',
			id: product.id,
			authInterface,
			data: dataToUpdate,
			method: 'put',
		});
		return response;
	}

	async checkType(type, authInterface): Promise<boolean> {
		let result: StrapiResult;
		try {
			result = await this.getType(type, authInterface);
		} catch (error) {
			this.loggerHelper.log('error', `${type} type not found in strapi`);
			this.loggerHelper.log('error', JSON.stringify(error));
			result = undefined;
		}
		return result ? true : false;
	}

	async updateProductVariantInStrapi(data, authInterface: AuthInterface): Promise<StrapiResult> {
		const updateFields = [
			'title',
			'prices',
			'sku',
			'material',
			'weight',
			'length',
			'height',
			'origin_country',
			'options',
		];
		let response = { status: 400 };
		// Update came directly from product variant service so only act on a couple
		// of fields. When the update comes from the product we want to ensure
		// references are set up correctly so we run through everything.
		if (data.fields) {
			const found =
				data.fields.find((f) => updateFields.includes(f)) || this.verifyDataContainsFields(data, updateFields);
			if (!found) {
				return { status: 400 };
			}
		}

		try {
			let variant;
			const ignore = await this.redisHelper.shouldIgnore(data.id, 'strapi');
			if (ignore) {
				return { status: 400 };
			}
			try {
				variant = await this.productVariantService_.retrieve(data.id, {
					relations: ['prices', 'options'],
				});
				this.loggerHelper.log('info', JSON.stringify(variant));
				try {
					if (variant) {
						// Update entry in Strapi

						response = await this.strapiHelper.updateEntryInStrapi({
							type: 'product-variants',
							id: variant.id,
							authInterface,
							data: { ...variant, ...data },
							method: 'put',
							query: data.query,
						});
						this.loggerHelper.log('info', 'Variant Strapi Id - ', response);
						return response;
					}
				} catch (e) {
					this.loggerHelper.log('info', JSON.stringify(variant));
				}
			} catch (e) {
				if (!variant) {
					response = await this.createProductVariantInStrapi(data.id, authInterface);
					this.loggerHelper.log('info', 'Created Variant Strapi Id - ', response);
					return response;
				}
			}
			return response;
		} catch (error) {
			this.loggerHelper.log('info', 'Failed to update product variant', data.id);
			return { status: 400 };
		}
	}

	async deleteProductMetafieldInStrapi(data: { id: string }, authInterface: AuthInterface): Promise<StrapiResult> {
		const ignore = await this.redisHelper.shouldIgnore(data.id, 'strapi');
		if (ignore) {
			return { status: 400 };
		}

		return await this.strapiHelper.deleteEntryInStrapi({
			type: 'product-metafields',
			id: data.id,
			authInterface,
			method: 'delete',
		});
	}

	async deleteProductInStrapi(data, authInterface: AuthInterface): Promise<StrapiResult> {
		const ignore = await this.redisHelper.shouldIgnore(data.id, 'strapi');
		if (ignore) {
			return { status: 400 };
		}

		return await this.strapiHelper.deleteEntryInStrapi({
			type: 'products',
			id: data.id,
			authInterface,
			method: 'delete',
		});
	}

	async deleteProductTypeInStrapi(data, authInterface: AuthInterface): Promise<StrapiResult> {
		const ignore = await this.redisHelper.shouldIgnore(data.id, 'strapi');
		if (ignore) {
			return { status: 400 };
		}

		return await this.strapiHelper.deleteEntryInStrapi({
			type: 'product-types',
			id: data.id,
			authInterface,
			method: 'delete',
		});
	}

	async deleteProductVariantInStrapi(data, authInterface: AuthInterface): Promise<StrapiResult> {

		const ignore = await this.redisHelper.shouldIgnore(data.id, 'strapi');
		if (ignore) {
			return { status: 400 };
		}

		return await this.strapiHelper.deleteEntryInStrapi({
			type: 'product-variants',
			id: data.id,
			authInterface,
			method: 'delete',
		});
	}

	// Blocker - Delete Region API
	async deleteRegionInStrapi(data, authInterface): Promise<StrapiResult> {

		const ignore = await this.redisHelper.shouldIgnore(data.id, 'strapi');
		if (ignore) {
			return { status: 400 };
		}

		return await this.strapiHelper.deleteEntryInStrapi({
			type: 'regions',
			id: data.id,
			authInterface,
			method: 'delete',
		});
	}

	async deleteCollectionInStrapi(data, authInterface): Promise<StrapiResult> {

		const ignore = await this.redisHelper.shouldIgnore(data.id, 'strapi');
		if (ignore) {
			return { status: 400 };
		}

		return await this.strapiHelper.deleteEntryInStrapi({
			type: 'product-collections',
			id: data.id,
			authInterface,
			method: 'delete',
		});
	}
	async deleteCategoryInStrapi(data, authInterface): Promise<StrapiResult> {

		const ignore = await this.redisHelper.shouldIgnore(data.id, 'strapi');
		if (ignore) {
			return { status: 400 };
		}

		return await this.strapiHelper.deleteEntryInStrapi({
			type: 'product-categories',
			id: data.id,
			authInterface,
			method: 'delete',
		});
	}

	async getType(type: string, authInterface: AuthInterface): Promise<StrapiResult> {
		const result = await this.strapiHelper.strapiSendDataLayer({
			method: 'get',
			type,
			authInterface,
		});
		return result;
	}

	async doesEntryExistInStrapi(
		type: string,
		id: string,

		authInterface: AuthInterface
	): Promise<StrapiResult> {

		return await this.strapiHelper.processStrapiEntry({
			method: 'get',
			type,
			id,
			authInterface,
		});
	}

	verifyDataContainsFields(data: any, updateFields: any[]): boolean {
		if (!data || isEmpty(data)) return false;
		let found = data.fields?.find((f) => updateFields.includes(f));
		if (!found) {
			try {
				const fieldsOfdata = Object.keys(data);
				found = fieldsOfdata.some((field) => {
					return updateFields.some((uf) => {
						return uf == field;
					});
				});
			} catch (e) {
				this.loggerHelper.log('error', JSON.stringify(e));
			}
		}
		return found;
	}


}
export default UpdateStrapiService;