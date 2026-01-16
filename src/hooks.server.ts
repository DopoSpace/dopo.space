/**
 * SvelteKit Server Hooks
 *
 * Global server-side middleware for authentication, subdomain routing,
 * and request handling.
 */

import type { Handle } from '@sveltejs/kit';
import { verifySessionToken } from '$lib/server/auth/magic-link';
import { prisma } from '$lib/server/db/prisma';
import { detectSubdomain, isRouteAllowedOnSubdomain } from '$lib/server/utils/subdomain';
import {
	USER_SESSION_COOKIE_NAME,
	ADMIN_SESSION_COOKIE_NAME
} from '$lib/server/config/constants';
import pino from 'pino';

// Validate environment variables at startup (will throw if invalid)
import '$lib/server/config/env';

const logger = pino({ name: 'hooks' });

export const handle: Handle = async ({ event, resolve }) => {
	const pathname = event.url.pathname;
	const hostname = event.url.hostname;

	// Step 1: Detect subdomain context
	const subdomainContext = detectSubdomain(hostname);
	event.locals.subdomainContext = subdomainContext;

	// Step 1.5: Redirect root path on admin subdomain to login
	if (subdomainContext === 'admin' && pathname === '/') {
		return new Response(null, {
			status: 302,
			headers: { location: '/login' }
		});
	}

	// Step 2: Check if route is allowed on this subdomain
	const routeCheck = isRouteAllowedOnSubdomain(pathname, subdomainContext);

	if (!routeCheck.allowed) {
		if (routeCheck.redirectTo) {
			// Redirect to correct subdomain
			return new Response(null, {
				status: 302,
				headers: { location: routeCheck.redirectTo }
			});
		}
		// API routes return 403 Forbidden
		return new Response('Forbidden', { status: 403 });
	}

	// Step 3: Handle authentication based on subdomain context
	if (subdomainContext === 'admin') {
		// Admin subdomain: only read admin cookie
		const adminToken = event.cookies.get(ADMIN_SESSION_COOKIE_NAME);

		if (adminToken) {
			const payload = verifySessionToken(adminToken);

			if (payload && payload.role === 'admin') {
				try {
					const admin = await prisma.admin.findUnique({
						where: { id: payload.userId }
					});

					if (admin) {
						if (admin.sessionsInvalidatedAt && payload.issuedAt < admin.sessionsInvalidatedAt) {
							// Session was issued before the invalidation timestamp - reject it
							event.cookies.delete(ADMIN_SESSION_COOKIE_NAME, { path: '/' });
						} else {
							event.locals.admin = admin;
						}
					}
				} catch (error) {
					logger.error({ err: error, userId: payload.userId }, 'Database error during admin session validation');
					event.cookies.delete(ADMIN_SESSION_COOKIE_NAME, { path: '/' });
				}
			}
		}

		// Protect admin routes (except login)
		if (pathname.startsWith('/admin') && !pathname.startsWith('/admin/login')) {
			if (!event.locals.admin) {
				return new Response(null, {
					status: 302,
					headers: { location: '/login' }
				});
			}
		}
	} else {
		// Main domain: only read user cookie
		const userToken = event.cookies.get(USER_SESSION_COOKIE_NAME);

		if (userToken) {
			const payload = verifySessionToken(userToken);

			if (payload && payload.role === 'user') {
				try {
					// Fetch minimal data for session validation
					// Routes that need profile/membership should load them explicitly
					const user = await prisma.user.findUnique({
						where: { id: payload.userId },
						select: {
							id: true,
							email: true,
							phone: true,
							newsletterSubscribed: true,
							sessionsInvalidatedAt: true,
							createdAt: true,
							updatedAt: true,
							mailchimpSubscriberId: true,
							profile: true,
							memberships: {
								orderBy: { createdAt: 'desc' },
								take: 1
							}
						}
					});

					if (user) {
						if (user.sessionsInvalidatedAt && payload.issuedAt < user.sessionsInvalidatedAt) {
							// Session was issued before the invalidation timestamp - reject it
							event.cookies.delete(USER_SESSION_COOKIE_NAME, { path: '/' });
						} else {
							event.locals.user = user;
						}
					}
				} catch (error) {
					logger.error({ err: error, userId: payload.userId }, 'Database error during user session validation');
					event.cookies.delete(USER_SESSION_COOKIE_NAME, { path: '/' });
				}
			}
		}

		// Protect membership routes
		if (pathname.startsWith('/membership')) {
			if (!event.locals.user) {
				return new Response(null, {
					status: 302,
					headers: { location: '/auth/login' }
				});
			}
		}
	}

	return resolve(event);
};
