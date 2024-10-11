import {MedusaRequest , MedusaResponse} from "@medusajs/medusa"
import UpdateStrapiService from '../../../services/update-strapi';

/**
 * Sync Medusa with Strapi
 * 
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
	const updateStrapiService = req.scope.resolve('UpdateStrapiService') as UpdateStrapiService;

	if (updateStrapiService.strapiSuperAdminAuthToken) {
		try {
			await updateStrapiService.strapiHelper.getServer().executeSync(updateStrapiService.strapiSuperAdminAuthToken);
		} catch (e) {
			res.sendStatus(500);
			return;
		}
		res.sendStatus(200);
	} else {
		res.status(500).send("Strapi server hasn't been initalised");
	}
};