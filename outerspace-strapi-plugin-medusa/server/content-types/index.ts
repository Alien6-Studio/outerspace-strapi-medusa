"use strict";

import isoCountry from "./iso-country";
import currency from "./currency";
import fulfillmentProvider from "./fulfillment-provider";
import image from "./image";
import moneyAmount from "./money-amount";
import paymentProvider from "./payment-provider";
import product from "./product";
import productCategory from "./product-category";
import productCollection from "./product-collection";
import productDocument from "./product-document";
import productLegal from "./product-legal";
import productMedia from "./product-media";
import productMetafield from "./product-metafield";
import productOption from "./product-option";
import productOptionValue from "./product-option-value";
import productTag from "./product-tag";
import productType from "./product-type";
import productVariant from "./product-variant";
import region from "./region";
import shippingOption from "./shipping-option";
import shippingOptionRequirement from "./shipping-option-requirement";
import shippingProfile from "./shipping-profile";
import store from "./store";

export default {
    'iso-country': isoCountry,
    'currency': currency,
    'fulfillment-provider': fulfillmentProvider,
    'image': image,
    'money-amount': moneyAmount,
    'payment-provider': paymentProvider,
    'product': product,
    'product-category': productCategory,
    'product-collection': productCollection,
    'product-document': productDocument,
    'product-legal': productLegal,
    'product-media': productMedia,
    'product-metafield': productMetafield,
    'product-option': productOption,
    'product-option-value': productOptionValue,
    'product-tag': productTag,
    'product-type': productType,
    'product-variant': productVariant,
    'region': region,
    'shipping-option': shippingOption,
    'shipping-option-requirement': shippingOptionRequirement,
    'shipping-profile': shippingProfile,
    'store': store,
};
