/**
 * Application Constants
 *
 * Centralized constants to avoid magic numbers and improve maintainability
 */

import { getMainDomain, getAdminDomain } from './env';

// Authentication & Security
export const USER_SESSION_COOKIE_NAME = 'user_session';
export const ADMIN_SESSION_COOKIE_NAME = 'admin_session';
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days
export const MAGIC_LINK_EXPIRY_MINUTES = 15;

// Password Hashing
export const BCRYPT_SALT_ROUNDS = 10;

/**
 * Get cookie options for user sessions (main domain)
 */
export function getUserCookieOptions(secure?: boolean) {
	const isProduction = process.env.NODE_ENV === 'production';
	const mainDomain = getMainDomain();

	// Extract domain without port for cookie domain
	const domainForCookie = mainDomain.split(':')[0];

	return {
		path: '/',
		httpOnly: true,
		sameSite: 'lax' as const,
		maxAge: SESSION_MAX_AGE_SECONDS,
		secure: secure ?? isProduction,
		// Only set domain in production (localhost doesn't need it)
		...(isProduction && { domain: domainForCookie })
	};
}

/**
 * Get cookie options for admin sessions (admin subdomain)
 */
export function getAdminCookieOptions(secure?: boolean) {
	const isProduction = process.env.NODE_ENV === 'production';
	const adminDomain = getAdminDomain();

	// Extract domain without port for cookie domain
	const domainForCookie = adminDomain.split(':')[0];

	return {
		path: '/',
		httpOnly: true,
		sameSite: 'strict' as const, // Stricter for admin
		maxAge: SESSION_MAX_AGE_SECONDS,
		secure: secure ?? isProduction,
		// Only set domain in production (localhost doesn't need it)
		...(isProduction && { domain: domainForCookie })
	};
}

// Deprecated: kept for backward compatibility during migration
/** @deprecated Use getUserCookieOptions() or getAdminCookieOptions() instead */
export const SESSION_COOKIE_NAME = 'session';

/** @deprecated Use getUserCookieOptions() or getAdminCookieOptions() instead */
export const COOKIE_OPTIONS = {
	path: '/',
	httpOnly: true,
	sameSite: 'lax' as const,
	maxAge: SESSION_MAX_AGE_SECONDS
};

/** @deprecated Use getUserCookieOptions() or getAdminCookieOptions() instead */
export function getCookieOptions(secure?: boolean) {
	return {
		...COOKIE_OPTIONS,
		secure: secure ?? process.env.NODE_ENV === 'production'
	};
}
