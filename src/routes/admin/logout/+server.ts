import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { ADMIN_SESSION_COOKIE_NAME, getAdminCookieOptions } from '$lib/server/config/constants';

export const POST: RequestHandler = async ({ cookies }) => {
	// Delete admin session cookie with same options used to set it
	const cookieOptions = getAdminCookieOptions();
	cookies.delete(ADMIN_SESSION_COOKIE_NAME, {
		path: cookieOptions.path,
		...(cookieOptions.domain && { domain: cookieOptions.domain })
	});

	// Redirect to login page
	throw redirect(303, '/admin/login');
};
