/**
 * Rate Limiting Utility
 *
 * In-memory rate limiter to prevent brute force attacks.
 *
 * IMPORTANT PRODUCTION CONSIDERATIONS:
 *
 * 1. SCALABILITY: This in-memory implementation is NOT suitable for production
 *    with multiple server instances. Each instance maintains its own store,
 *    allowing attackers to bypass limits by hitting different instances.
 *    TODO: Implement Redis-based rate limiting for production deployments.
 *    Recommended libraries: rate-limiter-flexible, ioredis
 *
 * 2. IP SPOOFING: The getClientIP function trusts X-Forwarded-For and X-Real-IP
 *    headers. This is ONLY SAFE if your application runs behind a trusted
 *    reverse proxy (nginx, cloudflare, etc.) that sets these headers.
 *    If deployed without a proxy, attackers can spoof IPs by setting headers.
 *    Configure your proxy to overwrite (not append) these headers.
 */

interface RateLimitEntry {
	count: number;
	resetAt: number;
}

export class RateLimiter {
	private store = new Map<string, RateLimitEntry>();
	private cleanupInterval: NodeJS.Timeout;

	constructor() {
		// Clean up expired entries every 5 minutes
		this.cleanupInterval = setInterval(() => {
			const now = Date.now();
			for (const [key, entry] of this.store.entries()) {
				if (entry.resetAt < now) {
					this.store.delete(key);
				}
			}
		}, 5 * 60 * 1000);
	}

	/**
	 * Check if a request should be rate limited
	 * @param key - Unique identifier (e.g., IP address, email)
	 * @param maxAttempts - Maximum allowed attempts
	 * @param windowMs - Time window in milliseconds
	 * @returns Object with allowed status and retry information
	 */
	check(
		key: string,
		maxAttempts: number,
		windowMs: number
	): { allowed: boolean; remainingAttempts: number; resetAt: number } {
		const now = Date.now();
		const entry = this.store.get(key);

		// No entry or expired - allow and create new entry
		if (!entry || entry.resetAt < now) {
			const resetAt = now + windowMs;
			this.store.set(key, { count: 1, resetAt });
			return {
				allowed: true,
				remainingAttempts: maxAttempts - 1,
				resetAt
			};
		}

		// Entry exists and not expired
		if (entry.count >= maxAttempts) {
			return {
				allowed: false,
				remainingAttempts: 0,
				resetAt: entry.resetAt
			};
		}

		// Increment count
		entry.count++;
		this.store.set(key, entry);

		return {
			allowed: true,
			remainingAttempts: maxAttempts - entry.count,
			resetAt: entry.resetAt
		};
	}

	/**
	 * Reset rate limit for a specific key
	 * @param key - The key to reset
	 */
	reset(key: string): void {
		this.store.delete(key);
	}

	/**
	 * Clear all rate limit entries
	 */
	clear(): void {
		this.store.clear();
	}

	/**
	 * Clean up the interval timer
	 */
	destroy(): void {
		clearInterval(this.cleanupInterval);
		this.clear();
	}
}

// Singleton instance
export const rateLimiter = new RateLimiter();

/**
 * Rate limit configurations
 */
export const RATE_LIMITS = {
	// Magic link: 5 attempts per 15 minutes per IP
	MAGIC_LINK: {
		maxAttempts: 5,
		windowMs: 15 * 60 * 1000
	},
	// Admin login: 5 attempts per 15 minutes per IP
	ADMIN_LOGIN: {
		maxAttempts: 5,
		windowMs: 15 * 60 * 1000
	},
	// Registration: 3 attempts per hour per IP
	REGISTRATION: {
		maxAttempts: 3,
		windowMs: 60 * 60 * 1000
	}
} as const;

/**
 * Get client IP address from request
 *
 * SECURITY NOTE: This function trusts proxy headers (X-Forwarded-For, X-Real-IP).
 * This is safe ONLY when:
 * - Your app runs behind a trusted reverse proxy (nginx, cloudflare, etc.)
 * - The proxy is configured to SET (not append) these headers
 * - Direct access to the application is blocked
 *
 * Without these conditions, attackers can spoof IP addresses.
 *
 * @param request - The request object
 * @returns The client IP address
 */
export function getClientIP(request: Request): string {
	// Check various headers for the real IP (reverse proxy support)
	// WARNING: Only trust these headers if behind a properly configured proxy
	const forwarded = request.headers.get('x-forwarded-for');
	if (forwarded) {
		// X-Forwarded-For format: client, proxy1, proxy2
		// First IP is the original client (if proxy is trusted)
		return forwarded.split(',')[0].trim();
	}

	const realIP = request.headers.get('x-real-ip');
	if (realIP) {
		return realIP;
	}

	// Fallback to localhost for development
	return '127.0.0.1';
}

/**
 * Helper function to check rate limit and return appropriate response
 * @param key - Rate limit key
 * @param config - Rate limit configuration
 * @returns null if allowed, Response object if rate limited
 */
export function checkRateLimit(
	key: string,
	config: { maxAttempts: number; windowMs: number }
): Response | null {
	const result = rateLimiter.check(key, config.maxAttempts, config.windowMs);

	if (!result.allowed) {
		const retryAfter = Math.ceil((result.resetAt - Date.now()) / 1000);
		return new Response(
			JSON.stringify({
				error: 'Too many requests. Please try again later.',
				retryAfter
			}),
			{
				status: 429,
				headers: {
					'Content-Type': 'application/json',
					'Retry-After': retryAfter.toString()
				}
			}
		);
	}

	return null;
}
