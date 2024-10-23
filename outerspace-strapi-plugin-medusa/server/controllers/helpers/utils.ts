import { Strapi } from '@strapi/strapi';


export interface IControllerProps {
    ctx: any;
    strapi: any;
    uid: any;
}

export interface IError {
    details: any; 
    name: any; 
    message: any; 
    stack: any; 
}

// Utils
export function handleError(strapi: Strapi, e: IError) {
	const details = JSON.stringify(e.details);
	strapi.log.error(`Error Occurred ${e.name} ${e.message}`);
	strapi.log.error(`Error Details ${details}`);
	strapi.log.error(`stack trace ${e.stack}`);
}

/**
 * Get fields without relations and media
 */
export function getFieldsWithoutRelationsAndMedia(attributes: any) {
	const keys = Object.keys(attributes);
	const fields = keys.filter((k) => !(attributes[k].relation || attributes[k].type == 'media'));
	return fields;
}

/**
 * Get Strapi entity by Medusa id
 */
export async function getStrapiDataByMedusaId(uid: any, strapi: any, medusa_id: string, fields: string[], locale: string) {
	const filters = { 
        medusa_id: medusa_id,
        locale: locale
    };

    try {
        const entities = await strapi.entityService.findMany(uid, {
            fields,
            filters,
            locale
        });
        console.log(`Found entity with medusa_id: ${medusa_id} and locale ${locale} and id ${entities?.[0]?.id}`);
        return entities?.[0];
	} catch (e) {
		strapi.log.debug(`entity doesn't exist`);
	}
}
