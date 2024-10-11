
"use strict";

import { getPluginConfig } from "../helpers/pluginConfig";

export default {

    isAdmin(policyContext, _, { strapi }) {

      const pluginConfig: any = getPluginConfig(strapi);
      const configRoles = pluginConfig("ROLES");
      
      if (!configRoles || configRoles.length <= 0) {
        return true;
      }
  
      /** @type {Array} */
      const userRoles = policyContext.state.user.roles;
      const hasRole = userRoles.find((r) => configRoles.includes(r.code));
      if (hasRole) {
        return true;
      }
  
      return false;
    },
  };