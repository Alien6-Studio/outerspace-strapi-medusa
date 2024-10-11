"use strict";

import { Strapi } from '@strapi/strapi';
import{ Config, buildConfig, setConfig }  from "./utils";



export default ({ strapi }: { strapi: Strapi }) => ({

  /**
   * Build and return plugin config
   */
  getConfig() {
    return {
      data: buildConfig(strapi, false),
    };
  },

  /**
   * Update the configuration
   * 
   */
  async setConfig(newConfig: Config) {
    setConfig(strapi, newConfig);
  }
});
