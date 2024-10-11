import { Strapi } from '@strapi/strapi';
import pluginId from "./pluginId";

export const getPluginConfig = (strapi: Strapi) => {
  return strapi.plugin(pluginId).config;
};

export const setPluginConfig = (strapi: Strapi, newConfig: any) => {
  // strapi.plugin(pluginId).config = {
  //   ...strapi.plugin(pluginId).config,
  //   ...newConfig,
  // };
};