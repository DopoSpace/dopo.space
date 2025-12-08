import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals, url }) => {
	const isLoginPage = url.pathname === '/admin/login';

	return {
		admin: locals.admin || null,
		isLoginPage
	};
};
