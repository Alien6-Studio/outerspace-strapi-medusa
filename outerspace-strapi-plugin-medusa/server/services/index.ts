import configService from './config-service';
import setupService from './setup-service';

// Content
import currencyService from './currency-service';
import fulfillmentProviderService from './fulfillment-provider-service';
import imageService from './image-service';
import isoCountryService from  './iso-country-service';
import moneyAmountService from './money-amount-service';    
import paymentProviderService from './payment-provider-service';
import productService from './product-service';
import productCategoryService from './product-category-service';
import productCollectionService from './product-collection-service';
import productDocumentService from './product-document-service';
import productLegalService from './product-legal-service';
import productMediaService from './product-media-service';
import productMetafieldService from './product-metafield-service';
import productOptionService from './product-option-service';
import productOptionValueService from './product-option-value-service';
import productTagService from './product-tag-service';
import productTypeService from './product-type-service';
import productVariantService from './product-variant-service';
import regionService from './region-service';
import shippingOptionService from './shipping-option-service';
import shippingOptionRequirementService from './shipping-option-requirement-service';
import shippingProfileService from './shipping-profile-service';
import storeService from './store-service';

export default {
    configService,
    setupService,

    // Content
    'currency': currencyService,
    'fulfillment-provider': fulfillmentProviderService,
    'image': imageService,
    'iso-country': isoCountryService,
    'money-amount': moneyAmountService,
    'payment-provider': paymentProviderService,
    'product': productService,
    'product-category': productCategoryService,
    'product-collection': productCollectionService,
    'product-document': productDocumentService,
    'product-legal': productLegalService,
    'product-media': productMediaService,
    'product-metafield': productMetafieldService,
    'product-option': productOptionService,
    'product-option-value': productOptionValueService,
    'product-tag': productTagService,
    'product-type': productTypeService,
    'product-variant': productVariantService,
    'region': regionService,
    'shipping-option': shippingOptionService,
    'shipping-option-requirement': shippingOptionRequirementService,
    'shipping-profile': shippingProfileService,
    'store': storeService
}