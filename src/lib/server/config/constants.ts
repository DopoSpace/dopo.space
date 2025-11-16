/**
 * Application Constants
 *
 * Centralized constants to avoid magic numbers and improve maintainability
 */

// Authentication & Security
export const SESSION_COOKIE_NAME = 'session';
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days
export const MAGIC_LINK_EXPIRY_MINUTES = 15;

// Password Hashing
export const BCRYPT_SALT_ROUNDS = 10;

// Cookie Options
export const COOKIE_OPTIONS = {
	path: '/',
	httpOnly: true,
	sameSite: 'lax' as const,
	maxAge: SESSION_MAX_AGE_SECONDS
};

/**
 * Get cookie options with secure flag based on environment
 */
export function getCookieOptions(secure?: boolean) {
	return {
		...COOKIE_OPTIONS,
		secure: secure ?? process.env.NODE_ENV === 'production'
	};
}
