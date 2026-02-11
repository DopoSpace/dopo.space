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
export const MAGIC_LINK_EXPIRY_MINUTES = 30;

// Password Hashing
export const BCRYPT_SALT_ROUNDS = 10;

/**
 * Check if running in production environment
 * Accepts multiple production-like values for safety
 */
function isProductionEnvironment(): boolean {
	const env = process.env.NODE_ENV?.toLowerCase();
	return env === 'production' || env === 'prod';
}

/**
 * Get cookie options for user sessions (main domain)
 */
export function getUserCookieOptions(secure?: boolean) {
	const isProduction = isProductionEnvironment();
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
	const isProduction = isProductionEnvironment();
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

