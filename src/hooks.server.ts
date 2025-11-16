/**
 * SvelteKit Server Hooks
 *
 * Global server-side middleware for authentication and request handling.
 */

import type { Handle } from '@sveltejs/kit';
import { verifySessionToken } from '$lib/server/auth/magic-link';
import { prisma } from '$lib/server/db/prisma';

// Validate environment variables at startup (will throw if invalid)
import '$lib/server/config/env';

export const handle: Handle = async ({ event, resolve }) => {
	// Get session token from cookie
	const sessionToken = event.cookies.get('session');

	if (sessionToken) {
		// Verify token
		const payload = verifySessionToken(sessionToken);

		if (payload) {
			// Use role from JWT to execute only 1 query instead of 2 (performance optimization)
			if (payload.role === 'admin') {
				const admin = await prisma.admin.findUnique({
					where: { id: payload.userId }
				});

				// Check if session was invalidated (for logout from all devices)
				if (admin) {
					if (admin.sessionsInvalidatedAt && payload.issuedAt < admin.sessionsInvalidatedAt) {
						// Session was issued before the invalidation timestamp - reject it
						event.cookies.delete('session', { path: '/' });
					} else {
						event.locals.admin = admin;
					}
				}
			} else {
				// role === 'user' (or default)
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

				// Check if session was invalidated (for logout from all devices)
				if (user) {
					if (user.sessionsInvalidatedAt && payload.issuedAt < user.sessionsInvalidatedAt) {
						// Session was issued before the invalidation timestamp - reject it
						event.cookies.delete('session', { path: '/' });
					} else {
						event.locals.user = user;
					}
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
