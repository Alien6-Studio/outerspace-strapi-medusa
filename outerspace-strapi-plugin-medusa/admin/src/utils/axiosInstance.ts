import axios from 'axios';
import { auth } from '@strapi/helper-plugin';

const instance = axios.create({
  baseURL: process.env.STRAPI_ADMIN_BACKEND_URL,
});

instance.interceptors.request.use(
  async config => {
    config.headers.set('Authorization', `Bearer ${auth.getToken()}`);
    config.headers.set('Accept', 'application/json');
    config.headers.set('Content-Type', 'application/json');

    return config;
  },
  error => {
    Promise.reject(new Error(error.message));
  }
);

instance.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401) {
      auth.clearAppStorage();
      window.location.reload();
    } else if (error.response?.status === 403) {
      console.error("Access forbidden: You don't have permission to access this resource.");
    }

    throw error;
  }
);

export default instance;