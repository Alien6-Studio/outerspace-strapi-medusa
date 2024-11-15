import { BaseEntity } from '@medusajs/medusa';

/**
* Response type for admin authentication operations
* Contains user information and authentication token
*/
export type AdminAuthResponse = {
   data: {
       user: {
           email: string;
           firstname?: string;
           lastname?: string;
       };
       token: string;
   };
};

/**
* Basic admin operation result
* Contains generic data and status code
*/
export type AdminResult = { 
   data: any; 
   status: number 
};

/**
* Response type for admin GET operations
* Includes paginated results and metadata
*/
export type AdminGetResult = {
   data: {
       data: {
           results: [];
       };
       meta: any;
   };
   status: number;
};

/**
* Generic response type for Medusa operations
* @template T Type of the data being returned
*/
export type MedusaGetResult<T> = {
   data: T;
   meta?: any;
   status: number;
   medusa_id?: string;
   id?: number;
};

/**
* Response type for Strapi operations
* Includes both single and array data responses
*/
export type StrapiResult = {
   medusa_id?: string;
   id?: number;
   data?: any | any[];
   meta?: Record<string, any>;
   status: number;
   query?: string;
};

/**
* Specific response type for Strapi GET operations
* Union type that includes both single and collection responses
*/
export type StrapiGetResult =
   | StrapiResult
   | {
       data: any[];
       meta?: any;
       status: number;
       medusa_id?: string;
       id?: number | string;
   };

/**
* Base type for Strapi entities
* Extends Medusa BaseEntity with optional medusa_id
*/
export type StrapiEntity = BaseEntity & { 
   medusa_id?: string 
};