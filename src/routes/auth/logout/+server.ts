import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { USER_SESSION_COOKIE_NAME, getUserCookieOptions } from '$lib/server/config/constants';

export const POST: RequestHandler = async ({ cookies }) => {
	// Delete user session cookie with same options used to set it
	// Note: SameSite=lax cookie attribute provides CSRF protection
	const cookieOptions = getUserCookieOptions();
	cookies.delete(USER_SESSION_COOKIE_NAME, {
		path: cookieOptions.path,
		...(cookieOptions.domain && { domain: cookieOptions.domain })
	});

	// Redirect to home page
	throw redirect(303, '/');
};
