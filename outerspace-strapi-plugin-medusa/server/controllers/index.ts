import configController from './config-controller';
import setupController from './setup-controller';

// Content 
import currencyController from './currency-controller';
import fulfillmentProviderController from './fulfillment-provider-controller';
import imageController from './image-controller';
import isoCountryController from './iso-country-controller';
import moneyAmountController from './money-amount-controller';
import paymentProviderController from './payment-provider-controller';
import productController from './product-controller';
import productCategoryController from './product-category-controller';
import productCollectionController from './product-collection-controller';
import productDocumentController from './product-document-controller';
import productLegalController from './product-legal-controller';
import productMediaController from './product-media-controller';
import productMetafieldController from './product-metafield-controller';
import productOptionController from './product-option-controller';
import productOptionValueController from './product-option-value-controller';
import productTagController from './product-tag-controller';
import productTypeController from './product-type-controller';
import productVariantController from './product-variant-controller';
import regionController from './region-controller';
import shippingOptionController from './shipping-option-controller';
import shippingOptionRequirementController from './shipping-option-requirement-controller';
import shippingProfileController from './shipping-profile-controller';
import storeController from './store-controller';

export default {
    configController,
    setupController,

    // Content
    'currency': currencyController,
    'fulfillment-provider': fulfillmentProviderController,
    'image': imageController,
    'iso-country': isoCountryController,
    'money-amount': moneyAmountController,
    'payment-provider': paymentProviderController,
    'product': productController,
    'product-category': productCategoryController,
    'product-collection': productCollectionController,
    'product-document': productDocumentController,
    'product-legal': productLegalController,
    'product-media': productMediaController,
    'product-metafield': productMetafieldController,
    'product-option': productOptionController,
    'product-option-value': productOptionValueController,
    'product-tag': productTagController,
    'product-type': productTypeController,
    'product-variant': productVariantController,
    'region': regionController,
    'shipping-option': shippingOptionController,
    'shipping-option-requirement': shippingOptionRequirementController,
    'shipping-profile': shippingProfileController,
    'store': storeController
}