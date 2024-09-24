import { factories } from '@strapi/strapi';
import { createNestedEntity } from '../../services/utils';
import _ from 'lodash';

/**
 * Overwrite the default controller for Medusa
 * 
 */
export function createMedusaDefaultController(uid) {
	return factories.createCoreController(uid, {
		async find(ctx) {
			return await controllerfindMany(ctx, strapi, uid);
		},
		async findOne(ctx) {
			return await controllerfindOne(ctx, strapi, uid);
		},
		async delete(ctx) {
			return await controllerDelete(ctx, strapi, uid);
		},
		async create(ctx) {
			return await controllerCreate(ctx, strapi, uid);
		},
		async update(ctx) {
			return await controllerUpdate(ctx, strapi, uid);
		},
	});
}

/**
 * Overwrite the findMany method for Medusa
 */
async function controllerfindMany(ctx, strapi, uid) {
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
		handleError(strapi, e);
		return ctx.internalServerError(ctx);
	}
}

/**
 * Overwrite the findOne method for Medusa
 */
async function controllerfindOne(ctx, strapi, uid) {
	const { id: medusa_id } = ctx.params;
	const apiName = uid.split('.')[1];
	const model = strapi.api[apiName].contentTypes;
	const fields = getFieldsWithoutRelationsAndMedia(model[apiName].attributes);
	strapi.log.debug(`requested ${uid} ${medusa_id}`);
	try {
		const entity = await getStrapiDataByMedusaId(uid, strapi, medusa_id, fields);

		if (entity && entity.id) {
			ctx.body = { data: entity };
			return (ctx.body);
		}
		return ctx.notFound(ctx);
	} catch (e) {
		handleError(strapi, e);
		return ctx.internalServerError(ctx);
	}
}

/**
 * Overwrite the delete method for Medusa
 */
async function controllerDelete(ctx, strapi, uid) {
	const { id: medusa_id } = ctx.params;
	try {
		const entityId = await getStrapiIdFromMedusaId(uid, strapi, medusa_id);
		if (!entityId) {
			return ctx.notFound(ctx);
		}
		const result = await strapi.services[uid].delete(entityId, { populate: '*' });
		if (result) {
			ctx.body = { deletedData: result };
			return (ctx.body);
		}
	} catch (e) {
		handleError(strapi, e);
		return ctx.internalServerError(ctx);
	}
}

/**
 * Overwrite the create method for Medusa
 */
async function controllerCreate(ctx, strapi, uid) {
	delete ctx.request.body?.data?.id;
	let processedData;

	let data = _.cloneDeep(ctx.request.body.data ?? ctx.request.body);
	strapi.log.info(`Medusa is creating entity ${uid} on Strapi`, { data: data });
	try {
		if (typeof data == 'string') {
			data = JSON.parse(data);
		}
		let files;
		if (ctx.request.files) {
			files = _.cloneDeep(ctx.request.files);
			delete data.files;
		}
		processedData = await createNestedEntity(uid, strapi, data);
		if (processedData && files) {
			processedData = await uploadFile(strapi, uid, files, processedData);
		}

		strapi.log.info(`created element ${uid} ${JSON.stringify(processedData)}`);
		ctx.body = { data: processedData };
		return (ctx.body);
	} catch (e) {
		handleError(strapi, e);
		return ctx.internalServerError(ctx);
	}
}

/**
 * Overwrite the update method for Medusa
 */
async function controllerUpdate(ctx, strapi, uid) {
	const { id: medusa_id } = ctx.params;
	delete ctx.request.body?.data?.id;
	const data = ctx.request.body.data || ctx.request.body;

	try {
		const entityId = await getStrapiIdFromMedusaId(uid, strapi, medusa_id);
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
		handleError(strapi, e);
		return ctx.internalServerError(ctx);
	}
}

// Utils
function handleError(strapi, e) {
	const details = JSON.stringify(e.details);
	strapi.log.error(`Error Occurred ${e.name} ${e.message}`);
	strapi.log.error(`Error Details ${details}`);
	strapi.log.error(`stack trace ${e.stack}`);
}

async function getStrapiIdFromMedusaId(uid, strapi, medusa_id) {
	return (await getStrapiDataByMedusaId(uid, strapi, medusa_id, ['medusa_id', 'id']))?.id;
}

async function getStrapiDataByMedusaId(uid, strapi, medusa_id, fields) {
	const filters = {
		medusa_id: medusa_id,
	};
	let entity;
    
	try {
        const entities = await strapi.entityService.findMany(uid, {
            fields,
            filters,
        });
        return entities?.[0];
	} catch (e) {
		strapi.log.debug(`${JSON.stringify(filters)} (entity doesn't exist)`);
	}
}

function getFieldsWithoutRelationsAndMedia(attributes) {
	const keys = Object.keys(attributes);
	const fields = keys.filter((k) => !(attributes[k].relation || attributes[k].type == 'media'));
	return fields;
}

async function uploadFile(strapi, uid, fileData, processedData, fieldName = 'files') {
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