/**
 * Subdomain Detection Utility
 *
 * Determines which subdomain the request is targeting and validates
 * that routes are accessed from the correct subdomain.
 */

import { getMainDomain, getAdminSubdomain } from '$lib/server/config/env';

export type SubdomainContext = 'admin' | 'main';

/**
 * Detect subdomain context from request hostname
 *
 * @param hostname - The hostname from the request (e.g., "admin.dopo.space", "dopo.space")
 * @returns The subdomain context ('admin' or 'main')
 */
export function detectSubdomain(hostname: string): SubdomainContext {
	const adminSubdomain = getAdminSubdomain();
	const mainDomain = getMainDomain();

	// Remove port if present for comparison
	const hostnameWithoutPort = hostname.split(':')[0];
	const mainDomainWithoutPort = mainDomain.split(':')[0];

	// Check for admin subdomain
	const expectedAdminHost = `${adminSubdomain}.${mainDomainWithoutPort}`;

	if (hostnameWithoutPort === expectedAdminHost) {
		return 'admin';
	}

	// Development: also check for admin.localhost patterns
	if (
		hostnameWithoutPort.startsWith('admin.localhost') ||
		hostnameWithoutPort.startsWith('admin.127.0.0.1')
	) {
		return 'admin';
	}

	return 'main';
}

/**
 * Check if a route is allowed on the given subdomain
 *
 * Rules:
 * - /admin/* routes are only allowed on admin subdomain
 * - /membership/* and /auth/* routes are only allowed on main domain
 * - Public routes (/, /api/webhooks/*, etc.) are allowed on both
 *
 * @param pathname - The URL pathname
 * @param context - The subdomain context
 * @returns Object with 'allowed' boolean and optional 'redirectTo' URL
 */
export function isRouteAllowedOnSubdomain(
	pathname: string,
	context: SubdomainContext
): { allowed: boolean; redirectTo?: string } {
	const isProduction = process.env.NODE_ENV === 'production';
	const protocol = isProduction ? 'https' : 'http';
	const mainDomain = getMainDomain();
	const adminSubdomain = getAdminSubdomain();

	// Admin routes only allowed on admin subdomain
	if (pathname.startsWith('/admin')) {
		if (context !== 'admin') {
			return {
				allowed: false,
				redirectTo: `${protocol}://${adminSubdomain}.${mainDomain}${pathname}`
			};
		}
	}

	// User routes (/membership/*, /auth/*) only allowed on main domain
	if (pathname.startsWith('/membership') || pathname.startsWith('/auth')) {
		if (context === 'admin') {
			return {
				allowed: false,
				redirectTo: `${protocol}://${mainDomain}${pathname}`
			};
		}
	}

	// API routes for admin only on admin subdomain
	if (pathname.startsWith('/api/admin')) {
		if (context !== 'admin') {
			// Return 403 for API routes instead of redirect
			return { allowed: false };
		}
	}

	// Public routes allowed on both subdomains:
	// - / (homepage)
	// - /api/webhooks/* (PayPal webhooks, etc.)
	// - /api/newsletter/* (newsletter subscriptions)
	// - Static assets
	return { allowed: true };
}

/**
 * Get the URL for the main domain
 */
export function getMainDomainUrl(path: string = '/'): string {
	const isProduction = process.env.NODE_ENV === 'production';
	const protocol = isProduction ? 'https' : 'http';
	const mainDomain = getMainDomain();
	return `${protocol}://${mainDomain}${path}`;
}

/**
 * Get the URL for the admin domain
 */
export function getAdminDomainUrl(path: string = '/'): string {
	const isProduction = process.env.NODE_ENV === 'production';
	const protocol = isProduction ? 'https' : 'http';
	const mainDomain = getMainDomain();
	const adminSubdomain = getAdminSubdomain();
	return `${protocol}://${adminSubdomain}.${mainDomain}${path}`;
}
