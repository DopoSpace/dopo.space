import { redirect, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { ADMIN_SESSION_COOKIE_NAME } from '$lib/server/config/constants';
import { APP_URL } from '$env/static/private';

/**
 * Validate CSRF protection via Origin header
 * Ensures logout requests come from our own site, not from malicious third-party sites
 */
function validateOrigin(request: Request): boolean {
	const origin = request.headers.get('origin');

	// If no origin header, check referer as fallback
	if (!origin) {
		const referer = request.headers.get('referer');
		if (!referer) {
			// Browser may not send origin/referer for same-origin requests
			// Allow these since SameSite cookies provide protection
			return true;
		}
		try {
			const refererUrl = new URL(referer);
			const appUrl = new URL(APP_URL);
			return refererUrl.origin === appUrl.origin;
		} catch {
			return false;
		}
	}

	try {
		const appUrl = new URL(APP_URL);
		return origin === appUrl.origin;
	} catch {
		return false;
	}
}

export const POST: RequestHandler = async ({ request, cookies }) => {
	// CSRF protection: validate that the request comes from our own site
	if (!validateOrigin(request)) {
		throw error(403, 'Invalid request origin');
	}

	// Delete admin session cookie
	cookies.delete(ADMIN_SESSION_COOKIE_NAME, {
		path: '/'
	});

	// Redirect to login page
	throw redirect(303, '/admin/login');
};
