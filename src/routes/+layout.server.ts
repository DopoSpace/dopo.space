import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
	return {
		user: locals.user || null,
		admin: locals.admin || null,
		isAdminRoute: locals.subdomainContext === 'admin',
		locale: locals.locale || 'it'
	};
};
