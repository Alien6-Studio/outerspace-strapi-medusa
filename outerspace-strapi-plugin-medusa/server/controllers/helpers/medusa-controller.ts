'use strict';

import { Strapi } from '@strapi/strapi';
import { factories } from '@strapi/strapi';
import { createNestedEntity } from '../../services/utils';
import { cloneDeep } from 'lodash';

import { 
	getFieldsWithoutRelationsAndMedia,
	getStrapiDataByMedusaId,
	handleError, 
	IControllerProps, 
	IError } from './utils';

/**
 * Overwrite the default controller for Medusa
 */
export function createMedusaDefaultController(uid: any) {
	return factories.createCoreController(uid, () => ({
		async find(ctx) {
			const props: IControllerProps = { ctx, strapi, uid };
			return await controllerfindMany(props);
		},
		async findOne(ctx) {
			const props: IControllerProps = { ctx, strapi, uid };
			return await controllerfindOne(props);
		},
		async delete(ctx) {
			const props: IControllerProps = { ctx, strapi, uid };
			return await controllerDelete(props);
		},
		async create(ctx) {
			const props: IControllerProps = { ctx, strapi, uid };
			return await controllerCreate(props);
		},
		async update(ctx) {
			const props: IControllerProps = { ctx, strapi, uid };
			return await controllerUpdate(props);
		},
	}));
}

/**
 * Overwrite the findMany method for Medusa
 */
export async function controllerfindMany(props: IControllerProps) {

	let { ctx, strapi, uid } = props;

	try {
		if (!ctx.query.fields?.includes('medusa_id')) {
			const fields = ctx.query.fields ? ctx.query.fields.push('medusa_id') : ['*'];
			ctx.query = {
				...ctx.query,
				fields,
			};
		}
		if (!ctx.query.pagination) {
			ctx.query = {
				...ctx.query,

				page: 1,
				pageSize: 25,
				withCount: true,
			};
		} else if (ctx.query.pagination.start) {
			const page =
				Math.floor(parseInt(ctx.query.pagination.start ?? '0') / parseInt(ctx.query.pagination.limit ?? '1')) +
				1;
			ctx.query = {
				...ctx.query,
				page,
				pageSize: ctx.query.pagination.limit,
				withCount: true,
			};
		} else {
			ctx.query = {
				...ctx.query,
				...ctx.query.pagination,
			};
		}

		const entity = await strapi.entityService.findPage(uid, ctx.query);
		strapi.log.debug(`requested  ${uid} query: ${JSON.stringify(ctx.query)}`);

		if (entity && entity.results.length > 0) {
			ctx.body = { data: entity.results, meta: entity.pagination };
			return (ctx.body);
		}
		
		return ctx.notFound(ctx);

	} catch (e) {
		handleError(strapi, e as IError);
		return ctx.internalServerError(ctx);
	}
}

/**
 * Overwrite the findOne method for Medusa
 */
export async function controllerfindOne(props: IControllerProps) {

	let { ctx, strapi, uid } = props;
	strapi.log.debug(`requested  ${uid} query: ${JSON.stringify(ctx.query)}`);

	const { id: medusa_id } = ctx.params;
	const apiName = uid.split('.')[1];
	const models = strapi.plugins['outerspace-strapi-plugin-medusa'].contentTypes;
	const fields = getFieldsWithoutRelationsAndMedia(models[apiName].attributes);
	const locale = 'en'; // as default value

	try {
		const entity = await getStrapiDataByMedusaId(uid, strapi, medusa_id, fields, locale);

		if (entity && entity.id) {
			ctx.body = { data: entity };
			return (ctx.body);
		}
		return ctx.notFound(ctx);
	} catch (e) {
		handleError(strapi, e as IError);
		return ctx.internalServerError(ctx);
	}
}

/**
 * Overwrite the delete method for Medusa
 */
export async function controllerDelete(props: IControllerProps) {

	let { ctx, strapi, uid } = props;
	const { id: medusa_id } = ctx.params;

	let id;
	let result;

	try {
		// for each locale, delete the entity
		for (const locale of ['en', 'fr']) {
			console.log(`Deleting ${uid} with medusa_id ${medusa_id} and locale ${locale}`);
			const entity = await getStrapiDataByMedusaId(uid, strapi, medusa_id, ['medusa_id', 'id'], locale);
			const entityId = entity?.id

			if (entityId) {
				id = entityId;
				result = await strapi.services[uid].delete(entityId, { populate: '*' });
			}
		}

		if (!id) {
			return ctx.notFound(ctx);
		}
		if (result) {
			ctx.body = { deletedData: result };
			return (ctx.body);
		}

	} catch (e) {
		handleError(strapi, e as IError);
		return ctx.internalServerError(ctx);
	}
}

/**
 * Overwrite the create method for Medusa
 */
export async function controllerCreate(props: IControllerProps) {

	let { ctx, strapi, uid } = props;
	let processedData;
	let data = cloneDeep(ctx.request.body.data ?? ctx.request.body);

	strapi.log.info(`Medusa is creating entity ${uid} on Strapi`, { data: data });

	try {
		if (typeof data == 'string') {
			data = JSON.parse(data);
		}
		let files;
		if (ctx.request.files) {
			files = cloneDeep(ctx.request.files);
			delete data.files;
		}
		processedData = await createNestedEntity(uid, strapi, data);

		if (processedData && files) {
			processedData = await uploadFile(strapi, uid, files, processedData);
		}

		ctx.body = { data: processedData };

		return (ctx.body);

	} catch (e) {
		handleError(strapi, e as IError);
		return ctx.internalServerError(ctx);
	}
}

/**
 * Overwrite the update method for Medusa
 */
async function controllerUpdate(props: IControllerProps) {

	let { ctx, strapi, uid } = props;
	const { id: medusa_id } = ctx.params;
	delete ctx.request.body?.data?.id;
	const data = ctx.request.body.data || ctx.request.body;
	const locale = 'en';

	try {
		const entity= await getStrapiDataByMedusaId(uid, strapi, medusa_id, ['medusa_id', 'id'], locale);
		const entityId = entity?.id

		if (entityId) {
			const processedData = await createNestedEntity(uid, strapi, data);
			delete processedData.medusa_id;
			let result = await strapi.services[uid].update(entityId, {
				data: { ...processedData, updateFrom: 'medusa' },
			});
			ctx.body = { data: result };
			return (ctx.body);
		} else {
			strapi.log.warn(`Cannot update entity ${medusa_id} of type ${uid} as it doesnt exist in strapi`);
			return ctx.notFound(ctx);
		}
	} catch (e) {
		handleError(strapi, e as IError);
		return ctx.internalServerError(ctx);
	}
}

/**
 * Upload file to entity
 */
async function uploadFile(strapi: any, uid: any, fileData: any, processedData: any, fieldName = 'files') {
	const service = strapi.service('plugin::upload.upload');
	const id = processedData.id;
	const field = fieldName;
	const files = fileData.files ?? fileData['files.files'];

	try {
		const params = {
			id,
			model: uid,
			field,
		};
		// Object.assign(params.model,theModel)
		await service.uploadToEntity(params, files);
		return processedData;
	} catch (e) {
		strapi.log.error('file upload failed');
		throw e;
	}
}