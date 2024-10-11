import { BaseEntity } from '@medusajs/medusa';

export type AdminResult = { data: any; status: number };

export type AdminGetResult = {
	data: {
		data: {
			results: [];
		};
		meta: any;
	};
	status: number;
};

export type MedusaGetResult<T> = {
    data: T;
    meta?: any;

    status: number;
    medusa_id?: string;
    id?: number;
};

export type StrapiResult = {
    medusa_id?: string;
    id?: number;
    data?: any | any[];
    meta?: Record<string, any>;
    status: number;
    query?: string;
};

export type StrapiGetResult =
    | StrapiResult
    | {
        data: any[];
        meta?: any;
        status: number;
        medusa_id?: string;
        id?: number | string;
    };

export type StrapiEntity = BaseEntity & { medusa_id?: string };