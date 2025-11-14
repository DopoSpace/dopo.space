import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ cookies }) => {
	// Delete admin session cookie only
	cookies.delete('admin_session', {
		path: '/'
	});

	// Redirect to admin login page
	throw redirect(303, '/admin/login');
};
