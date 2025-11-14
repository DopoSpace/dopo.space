import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ cookies }) => {
	// Delete session cookie
	cookies.delete('session', {
		path: '/'
	});

	// Redirect to home page
	throw redirect(303, '/');
};
