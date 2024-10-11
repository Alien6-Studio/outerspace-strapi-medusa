import {
	BaseEntity,
	EventBusService,
	Product,
	ProductCategoryService,
	ProductCollectionService,
	ProductService,
	ProductVariantService,
	RegionService,
} from '@medusajs/medusa';
import { Logger } from '@medusajs/medusa/dist/types/global';

// Custom imports
import { AuthInterface } from '../types/globals';
import UpdateStrapiService from '../services/update-strapi';

class StrapiSubscriber {

	productVariantService_: ProductVariantService;
	productService_: ProductService;
	strapiService_: UpdateStrapiService;
	eventBus_: EventBusService;
	loggedInUserAuth: AuthInterface;
	logger: Logger;

	constructor({ updateStrapiService, productVariantService, productService, eventBusService, logger }) {
		this.productVariantService_ = productVariantService;
		this.productService_ = productService;
		this.strapiService_ = updateStrapiService;
		this.eventBus_ = eventBusService;
		this.logger = logger;
		this.logger.info('Strapi Subscriber Initialized');

		this.subscribeToRegionEvents();
		this.subscribeToProductVariantEvents();
		this.subscribeToProductEvents();
		this.subscribeToProductMetafieldEvents();
		this.subscribeToProductCollectionEvents();
		this.subscribeToProductCategoryEvents();
	}

	/**
	 * Returns the credentials of the logged in user
	 */
	async getLoggedInUserStrapiCreds(): Promise<AuthInterface> {
		return this.loggedInUserAuth;
	}

	getAuthInterface(): AuthInterface {
		return this.strapiService_.strapiHelper.getServer().getAuthInterface();
	}

	/**
	 * Sets the credentials of the logged in user
	 */
	setLoggedInUserCreds(email, password): void {
		this.loggedInUserAuth = {
			email,
			password,
		};
	}

	/**
	 * Subscribes to the events emitted by the RegionService
	 */
	subscribeToRegionEvents(): void {
		this.eventBus_.subscribe(RegionService.Events.CREATED, async (data: BaseEntity) => {
			const authInterace: AuthInterface =
				(await this.getLoggedInUserStrapiCreds()) ?? this.strapiService_.getAuthInterface();
			await this.strapiService_.createRegionInStrapi(data.id, authInterace);
		});
		this.eventBus_.subscribe(RegionService.Events.UPDATED, async (data: BaseEntity) => {
			const authInterace: AuthInterface =
				(await this.getLoggedInUserStrapiCreds()) ?? this.strapiService_.getAuthInterface();
			await this.strapiService_.updateRegionInStrapi(data.id, authInterace);
		});
		this.eventBus_.subscribe(RegionService.Events.DELETED, async (data) => {
			const authInterace: AuthInterface =
				(await this.getLoggedInUserStrapiCreds()) ?? this.strapiService_.getAuthInterface();
			await this.strapiService_.deleteRegionInStrapi(data, authInterace);
		});
	}

	/**
	 * Subscribes to the events emitted by the ProductVariantService
	 */
	subscribeToProductVariantEvents(): void {
		this.eventBus_.subscribe(ProductVariantService.Events.CREATED, async (data: BaseEntity) => {
			const authInterace: AuthInterface =
				(await this.getLoggedInUserStrapiCreds()) ?? this.strapiService_.getAuthInterface();
			await this.strapiService_.createProductVariantInStrapi(data.id, authInterace);
		});

		this.eventBus_.subscribe(ProductVariantService.Events.UPDATED, async (data) => {
			const authInterace: AuthInterface =
				(await this.getLoggedInUserStrapiCreds()) ?? this.strapiService_.getAuthInterface();
			await this.strapiService_.updateProductVariantInStrapi(data, authInterace);
		});
		this.eventBus_.subscribe(ProductVariantService.Events.DELETED, async (data) => {
			const authInterace: AuthInterface =
				(await this.getLoggedInUserStrapiCreds()) ?? this.strapiService_.getAuthInterface();
			await this.strapiService_.deleteProductVariantInStrapi(data, authInterace);
		});
	}

	subscribeToProductEvents(): void {
		this.eventBus_.subscribe(ProductService.Events.UPDATED, async (data: Product) => {
			const authInterace: AuthInterface =
				(await this.getLoggedInUserStrapiCreds()) ?? this.strapiService_.getAuthInterface();
			await this.strapiService_.updateProductInStrapi(data);
			if (data.variants?.length > 0) {
				const result = data.variants.map(async (value, index, array) => {
					await this.strapiService_.updateProductVariantInStrapi(value, authInterace);
				});
				await Promise.all(result);
			}
		});
		this.eventBus_.subscribe(ProductService.Events.CREATED, async (data: Product) => {
			const authInterace: AuthInterface =
				(await this.getLoggedInUserStrapiCreds()) ?? this.strapiService_.getAuthInterface();
			await this.strapiService_.createProductInStrapi(data.id, authInterace);
			if (data.variants?.length > 0) {
				const result = data.variants.map(async (value, index, array) => {
					await this.strapiService_.createProductVariantInStrapi(value.id, authInterace);
				});
				await Promise.all(result);
			}
		});
		this.eventBus_.subscribe(ProductService.Events.DELETED, async (data) => {
			const authInterace: AuthInterface =
				(await this.getLoggedInUserStrapiCreds()) ?? this.strapiService_.getAuthInterface();
			await this.strapiService_.deleteProductInStrapi(data, authInterace);
		});
	}

	/**
	 * Subscribes to the events emitted when a product metafield is created or updated
	 * There is no delete event for product metafields
	 */
	subscribeToProductMetafieldEvents(): void {
		this.eventBus_.subscribe(
			'product.metafields.create',
			async (data: BaseEntity & { value: Record<string, unknown> }) => {
				const authInterace: AuthInterface =
					(await this.getLoggedInUserStrapiCreds()) ?? this.strapiService_.getAuthInterface();
				await this.strapiService_.createProductMetafieldInStrapi(data.id, authInterace);
			}
		);
		this.eventBus_.subscribe(
			'product.metafields.update',
			async (data: BaseEntity & { value: Record<string, unknown> }) => {
				const authInterace: AuthInterface =
					(await this.getLoggedInUserStrapiCreds()) ?? this.strapiService_.getAuthInterface();
				await this.strapiService_.updateProductMetafieldInStrapi(data, authInterace);
			}
		);
	}

	/**
	 * Subscribes to the events emitted by the ProductCollectionService
	 */
	subscribeToProductCollectionEvents(): void {
		this.eventBus_.subscribe(
			ProductCollectionService.Events.UPDATED,
			async (data: BaseEntity & { data: Record<string, unknown> }) => {
				const authInterace: AuthInterface =
					(await this.getLoggedInUserStrapiCreds()) ?? this.strapiService_.getAuthInterface();
				await this.strapiService_.updateCollectionInStrapi(data, authInterace);
			}
		);
		this.eventBus_.subscribe(
			ProductCollectionService.Events.CREATED,
			async (data: BaseEntity & { data: Record<string, unknown> }) => {
				const authInterace: AuthInterface =
					(await this.getLoggedInUserStrapiCreds()) ?? this.strapiService_.getAuthInterface();
				await this.strapiService_.createCollectionInStrapi(data.id, authInterace);
			}
		);
		this.eventBus_.subscribe(
			ProductCollectionService.Events.PRODUCTS_ADDED,
			async (data: BaseEntity & { data: Record<string, unknown> }) => {
				const authInterace: AuthInterface =
					(await this.getLoggedInUserStrapiCreds()) ?? this.strapiService_.getAuthInterface();
				await this.strapiService_.updateProductsWithinCollectionInStrapi(data.id, authInterace);
			}
		);
		this.eventBus_.subscribe(
			ProductCollectionService.Events.PRODUCTS_REMOVED,
			async (data: BaseEntity & { data: Record<string, unknown> }) => {
				const authInterace: AuthInterface =
					(await this.getLoggedInUserStrapiCreds()) ?? this.strapiService_.getAuthInterface();
				await this.strapiService_.updateProductsWithinCollectionInStrapi(data.id, authInterace);
			}
		);
	}

	/**
	 * Subscribes to the events emitted by the ProductCategoryService
	 */
	subscribeToProductCategoryEvents(): void {
		this.eventBus_.subscribe(
			ProductCategoryService.Events.UPDATED,
			async (data: BaseEntity & { data: Record<string, unknown> }) => {
				const authInterace: AuthInterface =
					(await this.getLoggedInUserStrapiCreds()) ?? this.strapiService_.getAuthInterface();
				await this.strapiService_.updateCategoryInStrapi(data, authInterace);
			}
		);
		this.eventBus_.subscribe(
			ProductCategoryService.Events.CREATED,
			async (data: BaseEntity & { data: Record<string, unknown> }) => {
				const authInterace: AuthInterface =
					(await this.getLoggedInUserStrapiCreds()) ?? this.strapiService_.getAuthInterface();
				await this.strapiService_.createCategoryInStrapi(data.id, authInterace);
			}
		);
	}
}

export default StrapiSubscriber;