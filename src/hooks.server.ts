/**
 * SvelteKit Server Hooks
 *
 * Global server-side middleware for authentication and request handling.
 */

import type { Handle } from '@sveltejs/kit';
import { verifySessionToken } from '$lib/server/auth/magic-link';
import { prisma } from '$lib/server/db/prisma';

export const handle: Handle = async ({ event, resolve }) => {
	// Get session token from cookie
	const sessionToken = event.cookies.get('session');

	if (sessionToken) {
		// Verify token
		const payload = verifySessionToken(sessionToken);

		if (payload) {
			// Check if this is an admin
			const admin = await prisma.admin.findUnique({
				where: { id: payload.userId }
			});

			if (admin) {
				// Set admin in locals
				event.locals.admin = admin;
			} else {
				// Try to load as user
				const user = await prisma.user.findUnique({
					where: { id: payload.userId },
					include: {
						profile: true,
						memberships: {
							orderBy: { createdAt: 'desc' },
							take: 1
						}
					}
				});

				if (user) {
					event.locals.user = user;
				}
			}
		}
	}

	// Check if route requires authentication
	const pathname = event.url.pathname;

	// Admin-only routes (except /admin/login)
	if (pathname.startsWith('/admin') && !pathname.startsWith('/admin/login')) {
		if (!event.locals.admin) {
			// Not an admin - redirect to admin login page
			return new Response(null, {
				status: 302,
				headers: {
					location: '/admin/login'
				}
			});
		}
	}

	// User-protected routes (membership dashboard)
	if (pathname.startsWith('/membership')) {
		if (!event.locals.user) {
			// Redirect to login if not authenticated
			return new Response(null, {
				status: 302,
				headers: {
					location: '/auth/login'
				}
			});
		}
	}

	return resolve(event);
};
