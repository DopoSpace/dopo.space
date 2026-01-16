import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { ADMIN_SESSION_COOKIE_NAME } from '$lib/server/config/constants';

export const POST: RequestHandler = async ({ cookies }) => {
	// Delete admin session cookie
	cookies.delete(ADMIN_SESSION_COOKIE_NAME, {
		path: '/'
	});

	// Redirect to login page
	throw redirect(303, '/login');
};
