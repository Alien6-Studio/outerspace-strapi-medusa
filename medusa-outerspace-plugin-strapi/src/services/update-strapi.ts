'use strict';

import { Logger } from '@medusajs/medusa/dist/types/global';
import { EntityManager } from 'typeorm';
import cloneDeep from 'lodash/cloneDeep';
import isEmpty from 'lodash/isEmpty';
import qs from 'qs';

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
	ProductCategoryService
} from '@medusajs/medusa';

// Custom imports
import { LoggerHelper } from './helpers/loggerHelper';
import { StrapiHelper }	from './helpers/strapiHelper';
import { RedisHelper } from './helpers/redisHelper';

import { StrapiResult, StrapiGetResult } from './types/types';

import {
	StrapiMedusaPluginOptions,
	AuthInterface,
	GetFromStrapiParams,
	StrapiSendParams,
} from '../types/globals';
import { log } from 'console';

/**
 * Parameters for the UpdateStrapiService
 */
export interface UpdateStrapiServiceParams {
	manager: EntityManager;
	regionService: RegionService;
	productService: ProductService;
	productVariantService: ProductVariantService;
	productTypeService: ProductTypeService;
	productCollectionService: ProductCollectionService;
	productCategoryService: ProductCategoryService;
	redisClient: any;
	eventBusService: EventBusService;
	logger: Logger;
}

/**
 * Service to update Strapi with Medusa data
 */
export class UpdateStrapiService extends TransactionBaseService {

	// Technical fields
	strapiSuperAdminAuthToken: string;
	key: WithImplicitCoercion<ArrayBuffer | SharedArrayBuffer>;
	options: StrapiMedusaPluginOptions;

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

		this.options = options;
		
		// Set the helpers
		let props = {
			redisClient: container.redisClient,
			eventBusService: container.eventBusService,
			logger: this.loggerHelper.getLogger(),
		};
		this.strapiHelper = new StrapiHelper(props, this.strapiSuperAdminAuthToken, options);
		this.redisHelper = this.strapiHelper.getRedisHelper();
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
			this.options
		);

		this.transactionManager_ = transactionManager;
		return cloned as this;
	}

	/**
	 * Public method to get entities from Strapi
	 */
	async getEntitiesFromStrapi(params: GetFromStrapiParams): Promise<StrapiGetResult> {
		await this.strapiHelper.checkType(params.strapiEntityType, params.authInterface);

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

	/**
	 * Create region in Strapi
	 */
	async createRegionInStrapi(regionId: string, authInterface: AuthInterface): Promise<StrapiResult> {
		try {
			await this.strapiHelper.checkType('regions', authInterface);

			// Get the entity
			const entity = await this.regionService_.retrieve(regionId, {
				relations: ['payment_providers', 'fulfillment_providers', 'currency'],
				select: ['id', 'name', 'tax_rate', 'tax_code', 'metadata'],
			});

			if (entity) {
				const data = cloneDeep(entity);
				return await this.strapiHelper.createEntryInStrapi({
					type: 'regions',
					id: regionId,
					authInterface,
					data: data
				});
			}
		} catch (error) {
			this.loggerHelper.log('error', `unable to create region ${regionId} ${error.message}`);
		}
	}

	/**
	 * Create product type in Strapi
	 */
	async createProductTypeInStrapi(productTypeId: string, authInterface: AuthInterface): Promise<StrapiResult> {
		try {
			await this.strapiHelper.checkType('product-types', authInterface);

			// Get the entity
			const entity = await this.productTypeService_.retrieve(productTypeId, {
				select: ['id', 'value'],
				relations: [],
			});

			if (entity) {
				const data = cloneDeep(entity);
				const result = await this.strapiHelper.createEntryInStrapi({
					type: 'product-types',
					id: productTypeId,
					authInterface: authInterface,
					data: data
				});
				return result;
			}
		} catch (error) {
			this.loggerHelper.log('error', `unable to create productType ${productTypeId} ${error.message}`);
		}
	}

	/**
	 * Create product collection in Strapi
	 */
	async createCollectionInStrapi(collectionId: string, authInterface: AuthInterface): Promise<StrapiResult> {
		try {
			await this.strapiHelper.checkType('product-collections', authInterface);

			// Get the entity
			const entity = await this.productCollectionService.retrieve(collectionId);

			if (entity) {
				const data = cloneDeep(entity);
				const result = await this.strapiHelper.createEntryInStrapi({
					type: 'product-collections',
					id: collectionId,
					authInterface,
					data: data
				});
				return result;
			}
		} catch (error) {
			this.loggerHelper.log('error', `unable to create collection ${collectionId} ${error.message}`);
		}
	}

	/**
	 * Create product category in Strapi
	 */
	async createCategoryInStrapi(categoryId: string, authInterface: AuthInterface): Promise<StrapiResult> {
		try {
			await this.strapiHelper.checkType('product-categories', authInterface);
			
			// Get the entity
			const entity = await this.productCategoryService.retrieve(categoryId);

			if (entity) {
				const data = cloneDeep(entity);
				const result = await this.strapiHelper.createEntryInStrapi({
					type: 'product-categories',
					id: categoryId,
					authInterface,
					data: data
				});
				return result;
			}
		} catch (error) {
			this.loggerHelper.log('error', `unable to create category ${categoryId} ${error.message}`);
		}
	}

	/**
	 * Create product metafield in Strapi
	 */
	async createProductMetafieldInStrapi(metafieldId: string, authInterface: AuthInterface =this.getAuthInterface()
	): Promise<StrapiResult> {
		try {
			await this.strapiHelper.checkType('product-metafields', authInterface);

			// Get the entity
			const entity = await this.productService_.retrieve(metafieldId);

			if (entity) {
				const data = cloneDeep(entity);
				const result = await this.strapiHelper.createEntryInStrapi({
					type: 'product-metafields',
					id: data.id,
					authInterface,
					data: data
				});
				return result;
			}
		} catch (error) {
			this.loggerHelper.log('error', `unable to create metafield ${metafieldId} ${error.message}`);
		}
	}
	
	/**
	 * Create product variant in Strapi
	 */
	async createProductVariantInStrapi(variantId, authInterface: AuthInterface): Promise<StrapiResult> {
		try {
			await this.strapiHelper.checkType('product-variants', authInterface);

			// Get the entity
			const entity = await this.productVariantService_.retrieve(variantId, {
				relations: ['prices', 'options', 'product'],
			});

			if (entity) {
				const data = cloneDeep(entity);

				// Remove money_amount from prices
				data['money_amount'] = cloneDeep(data.prices);
				delete data.prices;
				// Remove product option values from options ???
				data['product_option_value'] = cloneDeep(data.options);

				return await this.strapiHelper.createEntryInStrapi({
					type: 'product-variants',
					id: variantId,
					authInterface,
					data: data
				});
			}
		} catch (error) {
			this.loggerHelper.log('error', `unable to create variant ${variantId} ${error.message}`);
		}
	}

	/**
	 * Create product in Strapi
	 */
	async createProductInStrapi(productId, authInterface: AuthInterface): Promise<StrapiResult> {
		try {
			await this.strapiHelper.checkType('products', authInterface);

			const entity = await this.productService_.retrieve(productId, {
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
			if (entity) {
				const data = cloneDeep(entity);

				// This part of code seems to be very important, we cannot remove it

				// Remove product type
				// Here, we must change product_type to type_id
				// Then call the create type method
				data['product_type'] = cloneDeep(data.type);
				delete data.type;
				// Remove product tags
				data['product_tags'] = cloneDeep(data.tags);
				delete data.tags;
				// Remove product options
				data['product_options'] = cloneDeep(data.options);
				delete data.options;
				// Remove product variants
				data['product_variants'] = cloneDeep(data.variants);
				delete data.variants;
				// Remove product collection
				// Here, we see the relation with the collection has been removed
				data['product_collection'] = cloneDeep(data.collection);
				delete data.collection;
				// Remove product categories
				// For categories, we see the relation on the categoruy w/ the product
				// but not the product
				data['product_categories'] = cloneDeep(data.categories);
				delete data.categories;
				
				const result = await this.strapiHelper.createEntryInStrapi({
					type: 'products',
					authInterface,
					data: data
				});
				return result;
			}
		} catch (error) {
			this.loggerHelper.log('error', `unable to create product ${productId} ${error.message}`);
		}
	}

	/**
	 * Create product image in Strapi
	 */
	async createImageAssets(product: Product, authInterface: AuthInterface): Promise<StrapiResult> {
		const assets = await Promise.all(
			product.images
				?.filter((image) => image.url !== product.thumbnail)
				.map(async (image) => {
					const result = await this.strapiHelper.createEntryInStrapi({
						type: 'images',
						id: product.id,
						authInterface,
						data: image
					});
					return result;
				})
		);
		return assets ? { status: 200, data: assets } : { status: 400 };
	}

	/**
	 * Delete product metafield in Strapi
	 */
	async deleteProductMetafieldInStrapi(data: { id: string }, authInterface: AuthInterface): Promise<StrapiResult> {
		let command = {
			type: 'product-metafields',
			id: data.id,
			authInterface
		};

		return await this.strapiHelper.deleteEntryInStrapi(command);
	}

	/**
	 * Delete product in Strapi
	 */
	async deleteProductInStrapi(data, authInterface: AuthInterface): Promise<StrapiResult> {
		let command = {
			type: 'products',
			id: data.id, // Here, it does not read id
			authInterface
		};
		return await this.strapiHelper.deleteEntryInStrapi(command);
	}

	/**
	 * Delete product type in Strapi
	 */
	async deleteProductTypeInStrapi(data, authInterface: AuthInterface): Promise<StrapiResult> {
		let command = {
			type: 'product-types',
			id: data.id,
			authInterface
		};
		return await this.strapiHelper.deleteEntryInStrapi(command);
	}

	/**
	 * Delete product variant in Strapi
	 */
	async deleteProductVariantInStrapi(data, authInterface: AuthInterface): Promise<StrapiResult> {
		let command = {
			type: 'product-variants',
			id: data.id,
			authInterface
		};
		return await this.strapiHelper.deleteEntryInStrapi(command);
	}

	/**
	 * Delete region in Strapi
	 */
	async deleteRegionInStrapi(data, authInterface): Promise<StrapiResult> {
		let command = {
			type: 'regions',
			id: data.id,
			authInterface
		};
		return await this.strapiHelper.deleteEntryInStrapi(command);
	}

	/*
	 * Delete collection in Strapi
	 */
	async deleteCollectionInStrapi(data, authInterface): Promise<StrapiResult> {
		let command = {
			type: 'product-collections',
			id: data.id,
			authInterface
		};
		return await this.strapiHelper.deleteEntryInStrapi(command);
	}

	/**
	 * Delete category in Strapi
	 */
	async deleteCategoryInStrapi(data, authInterface): Promise<StrapiResult> {
		let command = {
			type: 'product-categories',
			id: data.id,
			authInterface
		};
		return await this.strapiHelper.deleteEntryInStrapi(command);
	}

	/**
	 * Update region in Strapi
	 */
	async updateRegionInStrapi(data, authInterface: AuthInterface = this.getAuthInterface()): Promise<StrapiResult> {

		// check if update contains any fields in Strapi to minimize runs
		const updateFields = ['name', 'currency_code', 'countries', 'payment_providers', 'fulfillment_providers'];
		const found = this.verifyDataContainsFields(data, updateFields);
		if (!found) {
			return { status: 400 };
		}

		try {
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
		}
	}

	/**
	 * Update collection in Strapi
	 * this comes directly from product collection service so only act on a couple
	 * of fields. When the update comes from the product we want to ensure
	 * references are set up correctly so we run through everything.
	 */
	async updateCollectionInStrapi(data, authInterface: AuthInterface): Promise<StrapiResult> {

		const updateFields = ['handle', 'title'];
		if (data.fields) {
			const found =
				data.fields.find((f) => updateFields.includes(f)) || this.verifyDataContainsFields(data, updateFields);
			if (!found) {
				return { status: 400 };
			}
		}

		try {
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

	/**
	 * Update category in Strapi
	 * this comes directly from product category service so only act on a couple
	 * of fields. When the update comes from the product we want to ensure
	 * references are set up correctly so we run through everything.
	 */
	async updateCategoryInStrapi(data, authInterface: AuthInterface): Promise<StrapiResult> {
		
		const updateFields = ['handle', 'name'];
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

	/**
	 * Update product type in Strapi
	 * this comes directly from product type service so only act on a couple
	 * of fields. When the update comes from the product we want to ensure
	 * references are set up correctly so we run through everything.
	 */
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
		if (data.fields) {
			const found =
				data.fields.find((f) => updateFields.includes(f)) || this.verifyDataContainsFields(data, updateFields);
			if (!found) {
				return { status: 400 };
			}
		}

		try {
			let variant;
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

	/**
	 * Update product metafield in Strapi
	 */
	async updateProductMetafieldInStrapi(
		data: { id: string; value: Record<string, unknown> },
		authInterface: AuthInterface
	): Promise<StrapiResult> {
		const typeExists = await this.strapiHelper.checkType('product-metafields', authInterface);
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

	/**
	 * Update product in Strapi
	 */
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

	/**
	 * Update product within collection in Strapi
	 */
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
	}

	/**
	 * Update product within category in Strapi
	 */
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
	}

	/**
	 * Helper function to check if an entry exists in Strapi
	 */
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

	/**
	 * Helper function to check if data contains fields
	 */
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

	/**
	 * Helper function to get custom field
	 */
	getCustomField(field, type): string {
		const customOptions = this.options[`custom_${type}_fields`];

		if (customOptions) {
			return customOptions[field] || field;
		} else {
			return field;
		}
	}

	/**
	 * Helper fonction to convert option value to medusa reference
	 */
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

	/**
	 * Helper function to adjust product and update in Strapi
	 * Medusa is not using consistent naming for product-*.
	 * We have to adjust it manually. For example: collection to product-collection
	 */
	private async adjustProductAndUpdateInStrapi(
		product: Product,
		data: Partial<Product>,
		authInterface: AuthInterface
	) {
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
}
export default UpdateStrapiService;