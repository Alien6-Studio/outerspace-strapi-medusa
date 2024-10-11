import axios from "./axiosInstance";
import pluginId from "../pluginId";

/**
 * Fetch and return plugin config
 */
export const getConfig = async () => {
  try {
    const response = await axios(`/${pluginId}/config`, { method: "GET" });
    return response.data;
  } catch (error) {
    console.error("Error while fetching configs.", error);
    throw error;
  }
};

/**
 * Update plugin config
 */
export const updateConfig = async (configData: any) => {
  try {
    const response = await axios(`/${pluginId}/config`, {
      method: "PUT",
      data: configData
    });
    return response.data;
  } catch (error) {
    console.error("Error while updating configs.", error);
    throw error;
  }
};

/** 
 * Synchonize Medusa tables with Strapi
 */
export const synchronizeWithMedusa = async () => {
  try {
    const response = await axios(`/${pluginId}/synchronise-medusa-tables`, {
      method: "POST"
    });
    return response.data;
  } catch (error) {
    console.error("Error while synchronizing with Medusa.", error);
    throw error;
  }
}