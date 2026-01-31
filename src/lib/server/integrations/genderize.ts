/**
 * Genderize.io Integration
 *
 * Provides gender inference from first names using Genderize.io API.
 * Free tier: 100 requests/day (no API key needed for basic usage)
 * With API key: higher limits based on plan
 *
 * Docs: https://genderize.io/
 */

import pino from 'pino';
import { getGenderizeApiKey } from '$lib/server/config/env';

const logger = pino({ name: 'genderize' });

const GENDERIZE_API = 'https://api.genderize.io';

// Minimum probability to accept a result (85%)
const MIN_PROBABILITY = 0.85;

export interface GenderizeResult {
	found: boolean;
	gender: 'M' | 'F' | null;
	probability: number;
	count: number;
	error?: string;
}

interface GenderizeApiResponse {
	count: number;
	name: string;
	gender: 'male' | 'female' | null;
	probability: number;
}

/**
 * Check if Genderize API is configured
 * Note: Genderize works without API key but with stricter rate limits (100/day per IP)
 */
export function isGenderizeConfigured(): boolean {
	// Enable even without API key (uses IP-based limit of 100/day)
	return true;
}

/**
 * Infer gender from a first name using Genderize.io API
 *
 * @param firstName - The first name to check
 * @param countryCode - ISO 3166-1 alpha-2 country code (default: IT for Italian names)
 */
export async function genderizeName(
	firstName: string,
	countryCode: string = 'IT'
): Promise<GenderizeResult> {
	if (!firstName || firstName.trim().length < 2) {
		return { found: false, gender: null, probability: 0, count: 0 };
	}

	try {
		const params = new URLSearchParams({
			name: firstName.trim(),
			country_id: countryCode
		});

		const apiKey = getGenderizeApiKey();
		if (apiKey) {
			params.set('apikey', apiKey);
		}

		const response = await fetch(`${GENDERIZE_API}?${params}`);

		if (!response.ok) {
			if (response.status === 429) {
				logger.warn('Genderize.io rate limit exceeded');
				return {
					found: false,
					gender: null,
					probability: 0,
					count: 0,
					error: 'Rate limit exceeded'
				};
			}
			logger.error({ status: response.status }, 'Genderize API error');
			return { found: false, gender: null, probability: 0, count: 0 };
		}

		const data: GenderizeApiResponse = await response.json();

		// No gender found for this name
		if (!data.gender || data.count === 0) {
			logger.debug({ name: firstName }, 'No gender found for name');
			return { found: false, gender: null, probability: 0, count: data.count };
		}

		// Check probability threshold
		if (data.probability < MIN_PROBABILITY) {
			logger.debug(
				{ name: firstName, probability: data.probability },
				'Gender probability below threshold'
			);
			return {
				found: false,
				gender: null,
				probability: data.probability,
				count: data.count
			};
		}

		// Map API response to our format
		const gender: 'M' | 'F' = data.gender === 'male' ? 'M' : 'F';

		logger.debug(
			{ name: firstName, gender, probability: data.probability, count: data.count },
			'Gender inferred from Genderize.io'
		);

		return {
			found: true,
			gender,
			probability: data.probability,
			count: data.count
		};
	} catch (error) {
		logger.error({ error, firstName }, 'Failed to call Genderize API');
		return {
			found: false,
			gender: null,
			probability: 0,
			count: 0,
			error: error instanceof Error ? error.message : 'Unknown error'
		};
	}
}

/**
 * Simple rate limiter for Genderize API
 * 100 requests/day = ~0.07 requests/minute
 * In practice, we burst during imports, so track daily usage
 */
class GenderizeRateLimiter {
	private requestCount = 0;
	private resetTime: number;
	private readonly maxRequests = 100; // Daily limit for free tier

	constructor() {
		this.resetTime = this.getNextResetTime();
	}

	private getNextResetTime(): number {
		// Reset at midnight UTC
		const now = new Date();
		const tomorrow = new Date(now);
		tomorrow.setUTCHours(24, 0, 0, 0);
		return tomorrow.getTime();
	}

	async acquire(): Promise<boolean> {
		const now = Date.now();

		// Reset counter if past reset time
		if (now >= this.resetTime) {
			this.requestCount = 0;
			this.resetTime = this.getNextResetTime();
			logger.debug('Daily rate limit counter reset');
		}

		// Check if under limit
		if (this.requestCount >= this.maxRequests) {
			logger.warn(
				{ requestCount: this.requestCount, maxRequests: this.maxRequests },
				'Daily Genderize rate limit reached'
			);
			return false;
		}

		this.requestCount++;
		return true;
	}

	/**
	 * Get current usage stats (for testing/debugging)
	 */
	getStats(): { requestCount: number; maxRequests: number; resetTime: Date } {
		return {
			requestCount: this.requestCount,
			maxRequests: this.maxRequests,
			resetTime: new Date(this.resetTime)
		};
	}

	/**
	 * Reset the rate limiter (for testing)
	 */
	reset(): void {
		this.requestCount = 0;
		this.resetTime = this.getNextResetTime();
	}
}

// Singleton rate limiter instance
const rateLimiter = new GenderizeRateLimiter();

/**
 * Genderize with rate limiting
 *
 * Use this function instead of genderizeName directly to respect daily limits.
 *
 * @param firstName - The first name to check
 * @param countryCode - ISO 3166-1 alpha-2 country code (default: IT for Italian names)
 */
export async function genderizeNameRateLimited(
	firstName: string,
	countryCode: string = 'IT'
): Promise<GenderizeResult> {
	const canProceed = await rateLimiter.acquire();

	if (!canProceed) {
		return {
			found: false,
			gender: null,
			probability: 0,
			count: 0,
			error: 'Daily rate limit exceeded'
		};
	}

	return genderizeName(firstName, countryCode);
}

/**
 * Export rate limiter for testing purposes
 */
export const _rateLimiter = rateLimiter;
