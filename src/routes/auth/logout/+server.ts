import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { SESSION_COOKIE_NAME } from '$lib/server/config/constants';

export const POST: RequestHandler = async ({ cookies }) => {
	// Delete session cookie
	cookies.delete(SESSION_COOKIE_NAME, {
		path: '/'
	});

	// Redirect to home page
	throw redirect(303, '/');
};
