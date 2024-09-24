"use strict";

import { getPluginConfig, setPluginConfig } from "../helpers/pluginConfig";

export interface Config {
  medusaSecret: string;
  medusaBackendUrl: string;
  medusaBackendAdmin: string;
  superuserEmail: string;
  superuserUsername: string;
  superuserPassword: string;
  roles: string[];
}

/**
 * Cypher sensitive information
 * 
 */
const cypher = (str) => {
  return str.replace(/./g, "*");
}

/**
 * Build config map object
 *
 */
export const buildConfig = (strapi, hideSensitiveInfo = false) => {
  const pluginConfig = getPluginConfig(strapi);

  const medusaSecret = pluginConfig("MEDUSA_STRAPI_SECRET");
  const superuserPassword = pluginConfig("SUPERUSER_PASSWORD");

  const config: Config = {
    medusaSecret: hideSensitiveInfo ? cypher(medusaSecret) : medusaSecret,
    medusaBackendUrl: pluginConfig("MEDUSA_BACKEND_URL"),
    medusaBackendAdmin: pluginConfig("MEDUSA_BACKEND_ADMIN"),
    superuserEmail: pluginConfig("SUPERUSER_EMAIL"),
    superuserUsername: pluginConfig("SUPERUSER_USERNAME"),
    superuserPassword: hideSensitiveInfo ? cypher(superuserPassword): superuserPassword,
    roles: pluginConfig("ROLES"),
  };

  return config;
};

/**
 * Set the plugin configuration
 *
 */
export const setConfig = (strapi, newConfig: Config) => {

  const pluginConfig: any = getPluginConfig(strapi);

    const updatedConfig = {
      ...pluginConfig,
      medusaSecret: newConfig.medusaSecret,
      medusaBackendUrl: newConfig.medusaBackendUrl,
      medusaBackendAdmin: newConfig.medusaBackendAdmin,
      superuserEmail: newConfig.superuserEmail,
      superuserUsername: newConfig.superuserUsername,
      superuserPassword: newConfig.superuserPassword,
    };
    setPluginConfig(strapi, updatedConfig);
}