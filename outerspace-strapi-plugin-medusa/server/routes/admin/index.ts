import pluginId from "../../helpers/pluginId";

export default {
  type: 'admin',
  routes: [
    {
      method: 'GET',
      path: '/config',
      handler: 'configController.index',
      config: {
        policies: [`plugin::${pluginId}.isAdmin`],
      },
    },
    {
      method: 'PUT',
      path: '/config',
      handler: 'configController.update',
      config: {
        policies: [`plugin::${pluginId}.isAdmin`],
      },  
    },
    {
      method: 'POST',
      path: '/create-medusa-user',
      handler: 'setupController.createMedusaUser',
      config: {
        policies: [`plugin::${pluginId}.isAdmin`],
      },  
    },
    {
      method: 'POST',
      path: '/synchronise-medusa-tables',
      handler: 'setupController.synchroniseWithMedusa',
      config: {
        policies: [`plugin::${pluginId}.isAdmin`],
      },  
    },
  ],
};
