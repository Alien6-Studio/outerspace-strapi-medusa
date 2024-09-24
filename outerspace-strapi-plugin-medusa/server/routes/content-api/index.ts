import currencyRoute from './currency.json';
import fulfillmentProviderRoute from './fulfillment-provider.json';
import imageRoute from './image.json';
import isoCountryRoute from './iso-country.json';
import moneyAmountRoute from './money-amount.json';
import paymentProviderRoute from './payment-provider.json';
import productRoute from './product.json';
import productCategoryRoute from './product-category.json';
import productCollectionRoute from './product-collection.json';
import productDocumentRoute from './product-document.json';
import productLegalRoute from './product-legal.json';
import productMediaRoute from './product-media.json';
import productMetafieldRoute from './product-metafield.json';
import productOptionRoute from './product-option.json';
import productOptionValueRoute from './product-option-value.json';
import productTagRoute from './product-tag.json';
import productTypeRoute from './product-type.json';
import productVariantRoute from './product-variant.json';
import regionRoute from './region.json';
import shippingOptionRoute from './shipping-option.json';
import shippingOptionRequirementRoute from './shipping-option-requirement.json';
import shippingProfileRoute from './shipping-profile.json';
import storeRoute from './store.json';

export default {
  type: 'content-api',
  routes: [
    ...currencyRoute.routes,
    ...fulfillmentProviderRoute.routes,
    ...imageRoute.routes,
    ...isoCountryRoute.routes,
    ...moneyAmountRoute.routes,
    ...paymentProviderRoute.routes,
    ...productRoute.routes,
    ...productCategoryRoute.routes,
    ...productCollectionRoute.routes,
    ...productDocumentRoute.routes,
    ...productLegalRoute.routes,
    ...productMediaRoute.routes,
    ...productMetafieldRoute.routes,
    ...productOptionRoute.routes,
    ...productOptionValueRoute.routes,
    ...productTagRoute.routes,
    ...productTypeRoute.routes,
    ...productVariantRoute.routes,
    ...regionRoute.routes,
    ...shippingOptionRoute.routes,
    ...shippingOptionRequirementRoute.routes,
    ...shippingProfileRoute.routes,
    ...storeRoute.routes,
  ],
};
