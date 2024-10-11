import {
	// Importing various services and models from Medusa
	FulfillmentProviderService,
	PaymentProviderService,
	Product,
	ProductCollection,
	ProductCollectionService,
	ProductService,
	Region,
	RegionService,
	ShippingOption,
	ShippingOptionService,
	ShippingProfile,
	ShippingProfileService,
	Store,
	StoreService,
} from '@medusajs/medusa';

import { Logger } from '@medusajs/medusa/dist/types/global';
import { NextFunction, Request, Response } from 'express';
import _ from 'lodash';

// Custom imports
import { transformMedusaToStrapiProduct } from '../../../utils/transformation';
import { UpdateStrapiService } from '../../../services/update-strapi';
import { StrapiEntity } from '../../../services/types/types';
import { StrapiSignalInterface } from './strapi-signal';

// Defines the type for the data being sent during the seeding process to Strapi.
// This can either be a record of multiple Strapi entities, a single entity, or a nested entity structure.
export type StrapiSeedType = Record<string, StrapiEntity[]> | Record<string, StrapiEntity> | StrapiEntity;

// Interface that represents the structure of the seed data sent to Strapi, including pagination metadata
export interface StrapiSeedInterface {
	meta: {
		pageNumber: number;
		pageLimit: number;
		hasMore: Record<string, boolean>;
	};
	data: StrapiSeedType;
}


/**
 * Translates the ids of Medusa entities to Strapi ids
 */
async function translateIdsToMedusaIds(dataToSend: StrapiSeedType): Promise<StrapiEntity | Record<string, StrapiEntity> | Record<string, StrapiEntity[]>> {
	
	if (!dataToSend) {
		return dataToSend;
	}
	// If the data is an array, iterate through each element and translate the ids
	const keys = Object.keys(dataToSend);
	for (const key of keys) {
		if (_.isArray(dataToSend[key])) {
			for (const element of dataToSend[key]) {
				// Recursively translate the ids of nested entities
				await translateIdsToMedusaIds(element);
			}
		} else if (dataToSend[key] instanceof Object) {
			// Recursively translate the ids of nested entities
			await translateIdsToMedusaIds(dataToSend[key]);
		} else if (key == 'id') {
			// Finally, if the key is 'id', rename it to 'medusa_id'
			dataToSend['medusa_id'] = dataToSend[key];
			delete dataToSend[key];
		}
	}
	return dataToSend;
}

/**
 * Handles the seed request from Medusa to Strapi
 * 
 * At this stage, some entities are still missing from the response, such as:
 * categories, variants, documents, etc.
 */
export default async (req: Request & { decodedMessage: StrapiSignalInterface }, res: Response, next: NextFunction) => {
	try {

		// Retrieve the logger from the request
		const logger = req.scope.resolve('logger') as Logger;

		// Retrieve the updateStrapiService from the request
		const updateStrapiService = req.scope.resolve('updateStrapiService') as UpdateStrapiService;
		const pageLimit = updateStrapiService.options.max_page_size ?? 50;
		const pageNumber = req.decodedMessage?.data?.meta?.pageNumber ?? 1;

		// Retrieve the necessary services from the request
		const productService = req.scope.resolve('productService') as ProductService;
		const regionService = req.scope.resolve('regionService') as RegionService;
		const paymentProviderService = req.scope.resolve('paymentProviderService') as PaymentProviderService;
		const fulfillmentProviderService = req.scope.resolve('fulfillmentProviderService') as FulfillmentProviderService;
		const shippingProfileService = req.scope.resolve('shippingProfileService') as ShippingProfileService;
		const shippingOptionService = req.scope.resolve('shippingOptionService') as ShippingOptionService;
		const storeService = req.scope.resolve('storeService') as StoreService;
		const productCollectionService = req.scope.resolve('productCollectionService') as ProductCollectionService;

		// Define the fields and relations to be fetched for each entity
		const storeFields: (keyof Store)[] = ['id', 'name'];
		const productFields: (keyof Product)[] = [
			'id',
			'title',
			'subtitle',
			'description',
			'handle',
			'is_giftcard',
			'discountable',
			'thumbnail',
			'weight',
			'length',
			'height',
			'width',
			'hs_code',
			'origin_country',
			'mid_code',
			'material',
			'metadata',
		];
		const regionFields: (keyof Region)[] = ['id', 'name', 'tax_rate', 'tax_code', 'metadata'];
		const shippingProfileFields: (keyof ShippingProfile)[] = ['id', 'name', 'type', 'metadata'];
		const shippingOptionFields: (keyof ShippingOption)[] = [
			'id',
			'name',
			'price_type',
			'amount',
			'is_return',
			'admin_only',
			'data',
			'metadata',
		];
		const productCollectionFields: (keyof ProductCollection)[] = ['id', 'title', 'handle'];

		// Define the relations to be fetched for each entity
		const productRelations = [
			'images',
			'options',
			'tags',
			'type',
			'collection',
			// Some are still missing: categories, variants, documents...
		];
		const storeRelations = ['currencies'];
		const regionRelations = ['countries', 'payment_providers', 'fulfillment_providers', 'currency'];
		const shippingProfileRelations = [
			'products', /** caution with the bootstrap duration */
			'shipping_options',
			'shipping_options.profile',
			'shipping_options.requirements',
			'shipping_options.provider',
			'shipping_options.region',
			'shipping_options.region.countries',
			'shipping_options.region.payment_providers',
			'shipping_options.region.fulfillment_providers',
			'shipping_options.region.currency',
		];
		const shippingOptionRelations = [
			'region',
			'region.countries',
			'region.payment_providers',
			'region.fulfillment_providers',
			'region.currency',
			'profile',
			'profile.products',
			'profile.shipping_options',
			'requirements',
			'provider',
		];
		const productCollectionRelations = ['products'];

		// Define the configurations for each entity
		const productCollectionListConfig = {
			skip: (pageNumber - 1) * pageLimit,
			take: pageLimit,
			select: productCollectionFields,
			relations: productCollectionRelations,
		};
		const productListConfig = {
			skip: (pageNumber - 1) * pageLimit,
			take: pageLimit,
			select: productFields,
			relations: productRelations,
		};
		const regionListConfig = {
			skip: (pageNumber - 1) * pageLimit,
			take: pageLimit,
			select: regionFields,
			relations: regionRelations,
		};
		const shippingOptionsConfig = {
			skip: (pageNumber - 1) * pageLimit,
			take: pageLimit,
			select: shippingOptionFields,
			relations: shippingOptionRelations,
		};
		const shippingProfileConfig = {
			skip: (pageNumber - 1) * pageLimit,
			take: pageLimit,
			select: shippingProfileFields,
			relations: shippingProfileRelations,
		};
		const storeConfig = {
			skip: (pageNumber - 1) * pageLimit,
			take: pageLimit,
			select: storeFields,
			relations: storeRelations,
		};

		// Define the paged entities to be fetched
		const pagedProductCollections = (await productCollectionService.list(
			{}, productCollectionListConfig)) as StrapiEntity[];
		const pagedRegions = (await regionService.list({}, regionListConfig)) as StrapiEntity[];
		const pagedProducts = (await productService.list({}, productListConfig)) as StrapiEntity[];
		const productsToTransform = pagedProducts.map(async (product) => {
			return await transformMedusaToStrapiProduct(product as Product);
		});
		const transformedPagedProducts = await Promise.all(productsToTransform);
		const pagedPaymentProviders = await paymentProviderService.list();
		const pagedFulfillmentProviders = await fulfillmentProviderService.list();
		const pagedShippingOptions = await shippingOptionService.list({}, shippingOptionsConfig);
		const pagedShippingProfiles = await shippingProfileService.list({}, shippingProfileConfig);
		const pagedStores = await storeService.retrieve(storeConfig);

		// Define the response object
		const response: Record<string, StrapiEntity[]> = {
			productCollections: pagedProductCollections,
			products: transformedPagedProducts,
			regions: pagedRegions,
			paymentProviders: pagedPaymentProviders as any,
			fulfillmentProviders: pagedFulfillmentProviders as any,
			shippingOptions: pagedShippingOptions,
			shippingProfiles: pagedShippingProfiles,
			stores: Array.isArray(pagedStores) ? pagedStores : [pagedStores],
		};

		// Translate the ids of Medusa entities to Strapi ids as medusa_id
		await translateIdsToMedusaIds(response);
		const seedResponse: StrapiSeedInterface = {
			meta: {
				pageNumber,
				pageLimit,
				hasMore: {
					productCollections: pagedProductCollections.length == pageLimit,
					products: pagedProducts.length == pageLimit,
					regions: pagedRegions.length == pageLimit,
					paymentProviders: pagedPaymentProviders.length == pageLimit,
					fulfillmentProviders: pagedFulfillmentProviders.length == pageLimit,
					shippingOptions: pagedShippingOptions.length == pageLimit,
					shippingProfiles: pagedShippingProfiles.length == pageLimit,
				},
			},
			data: response,
		};
		
		// Send the response to Strapi with the seed data
		logger.debug('Sending seed response to Strapi');
		res.status(200).send(seedResponse);

	} catch (error) {
		res.status(400).send(`Webhook error: ${error.message}`);
	}
};
