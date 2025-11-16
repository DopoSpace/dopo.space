/**
 * Tests for Rate Limiting Utility
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { RateLimiter, rateLimiter, getClientIP, checkRateLimit, RATE_LIMITS } from './rate-limit';

describe('RateLimiter Class', () => {
	let limiter: RateLimiter;

	beforeEach(() => {
		limiter = new RateLimiter();
	});

	afterEach(() => {
		limiter.destroy();
	});

	describe('check()', () => {
		it('should allow first request', () => {
			const result = limiter.check('test-key', 5, 60000);

			expect(result.allowed).toBe(true);
			expect(result.remainingAttempts).toBe(4);
			expect(result.resetAt).toBeGreaterThan(Date.now());
		});

		it('should track attempts correctly', () => {
			const result1 = limiter.check('test-key', 3, 60000);
			expect(result1.allowed).toBe(true);
			expect(result1.remainingAttempts).toBe(2);

			const result2 = limiter.check('test-key', 3, 60000);
			expect(result2.allowed).toBe(true);
			expect(result2.remainingAttempts).toBe(1);

			const result3 = limiter.check('test-key', 3, 60000);
			expect(result3.allowed).toBe(true);
			expect(result3.remainingAttempts).toBe(0);
		});

		it('should block after max attempts reached', () => {
			limiter.check('test-key', 2, 60000);
			limiter.check('test-key', 2, 60000);

			const result = limiter.check('test-key', 2, 60000);

			expect(result.allowed).toBe(false);
			expect(result.remainingAttempts).toBe(0);
		});

		it('should reset after time window expires', () => {
			vi.useFakeTimers();
			const now = Date.now();
			vi.setSystemTime(now);

			limiter.check('test-key', 2, 1000);
			limiter.check('test-key', 2, 1000);

			// Blocked
			let result = limiter.check('test-key', 2, 1000);
			expect(result.allowed).toBe(false);

			// Advance time past window
			vi.setSystemTime(now + 1001);

			// Should be allowed again
			result = limiter.check('test-key', 2, 1000);
			expect(result.allowed).toBe(true);
			expect(result.remainingAttempts).toBe(1);

			vi.useRealTimers();
		});

		it('should handle different keys independently', () => {
			limiter.check('key1', 1, 60000);
			const result1 = limiter.check('key1', 1, 60000);

			const result2 = limiter.check('key2', 1, 60000);

			expect(result1.allowed).toBe(false);
			expect(result2.allowed).toBe(true);
		});

		it('should return correct resetAt timestamp', () => {
			vi.useFakeTimers();
			const now = 1000000;
			vi.setSystemTime(now);

			const result = limiter.check('test-key', 5, 60000);

			expect(result.resetAt).toBe(now + 60000);

			vi.useRealTimers();
		});
	});

	describe('reset()', () => {
		it('should reset rate limit for specific key', () => {
			limiter.check('test-key', 1, 60000);
			limiter.check('test-key', 1, 60000);

			let result = limiter.check('test-key', 1, 60000);
			expect(result.allowed).toBe(false);

			limiter.reset('test-key');

			result = limiter.check('test-key', 1, 60000);
			expect(result.allowed).toBe(true);
		});

		it('should not affect other keys', () => {
			limiter.check('key1', 1, 60000);
			limiter.check('key2', 1, 60000);

			limiter.reset('key1');

			const result1 = limiter.check('key1', 1, 60000);
			const result2 = limiter.check('key2', 1, 60000);

			expect(result1.allowed).toBe(true);
			expect(result2.allowed).toBe(false);
		});
	});

	describe('clear()', () => {
		it('should clear all rate limits', () => {
			limiter.check('key1', 1, 60000);
			limiter.check('key2', 1, 60000);
			limiter.check('key1', 1, 60000);
			limiter.check('key2', 1, 60000);

			limiter.clear();

			const result1 = limiter.check('key1', 1, 60000);
			const result2 = limiter.check('key2', 1, 60000);

			expect(result1.allowed).toBe(true);
			expect(result2.allowed).toBe(true);
		});
	});

	describe('destroy()', () => {
		it('should clear interval and store', () => {
			limiter.check('key1', 1, 60000);

			limiter.destroy();

			// After destroy, store should be empty
			const result = limiter.check('key1', 1, 60000);
			expect(result.allowed).toBe(true);
		});
	});
});

describe('getClientIP', () => {
	it('should extract IP from X-Forwarded-For header', () => {
		const request = {
			headers: new Map([['x-forwarded-for', '192.168.1.1']])
		} as any;

		const ip = getClientIP(request);
		expect(ip).toBe('192.168.1.1');
	});

	it('should use first IP from comma-separated list', () => {
		const request = {
			headers: new Map([['x-forwarded-for', '192.168.1.1, 10.0.0.1, 127.0.0.1']])
		} as any;

		const ip = getClientIP(request);
		expect(ip).toBe('192.168.1.1');
	});

	it('should trim whitespace from IP', () => {
		const request = {
			headers: new Map([['x-forwarded-for', '  192.168.1.1  , 10.0.0.1']])
		} as any;

		const ip = getClientIP(request);
		expect(ip).toBe('192.168.1.1');
	});

	it('should fallback to X-Real-IP when X-Forwarded-For missing', () => {
		const request = {
			headers: new Map([['x-real-ip', '192.168.1.2']])
		} as any;

		const ip = getClientIP(request);
		expect(ip).toBe('192.168.1.2');
	});

	it('should default to 127.0.0.1 when no headers present', () => {
		const request = {
			headers: new Map()
		} as any;

		const ip = getClientIP(request);
		expect(ip).toBe('127.0.0.1');
	});

	it('should prefer X-Forwarded-For over X-Real-IP', () => {
		const request = {
			headers: new Map([
				['x-forwarded-for', '192.168.1.1'],
				['x-real-ip', '192.168.1.2']
			])
		} as any;

		const ip = getClientIP(request);
		expect(ip).toBe('192.168.1.1');
	});
});

describe('checkRateLimit', () => {
	beforeEach(() => {
		rateLimiter.clear();
	});

	it('should return null when within limit', () => {
		const response = checkRateLimit('test-key', { maxAttempts: 5, windowMs: 60000 });

		expect(response).toBeNull();
	});

	it('should return 429 response when limit exceeded', () => {
		for (let i = 0; i < 3; i++) {
			checkRateLimit('test-key', { maxAttempts: 2, windowMs: 60000 });
		}

		const response = checkRateLimit('test-key', { maxAttempts: 2, windowMs: 60000 });

		expect(response).toBeInstanceOf(Response);
		expect(response?.status).toBe(429);
	});

	it('should include Retry-After header', async () => {
		for (let i = 0; i < 3; i++) {
			checkRateLimit('test-key', { maxAttempts: 2, windowMs: 60000 });
		}

		const response = checkRateLimit('test-key', { maxAttempts: 2, windowMs: 60000 });

		expect(response?.headers.get('Retry-After')).toBeTruthy();
		const retryAfter = parseInt(response?.headers.get('Retry-After') || '0');
		expect(retryAfter).toBeGreaterThan(0);
	});

	it('should include Content-Type application/json', () => {
		for (let i = 0; i < 3; i++) {
			checkRateLimit('test-key', { maxAttempts: 2, windowMs: 60000 });
		}

		const response = checkRateLimit('test-key', { maxAttempts: 2, windowMs: 60000 });

		expect(response?.headers.get('Content-Type')).toBe('application/json');
	});

	it('should include error message in JSON', async () => {
		for (let i = 0; i < 3; i++) {
			checkRateLimit('test-key', { maxAttempts: 2, windowMs: 60000 });
		}

		const response = checkRateLimit('test-key', { maxAttempts: 2, windowMs: 60000 });
		const data = await response?.json();

		expect(data).toHaveProperty('error');
		expect(data?.error).toContain('Too many requests');
		expect(data).toHaveProperty('retryAfter');
	});
});

describe('RATE_LIMITS constants', () => {
	it('should have MAGIC_LINK configuration', () => {
		expect(RATE_LIMITS.MAGIC_LINK).toBeDefined();
		expect(RATE_LIMITS.MAGIC_LINK.maxAttempts).toBe(5);
		expect(RATE_LIMITS.MAGIC_LINK.windowMs).toBe(15 * 60 * 1000);
	});

	it('should have ADMIN_LOGIN configuration', () => {
		expect(RATE_LIMITS.ADMIN_LOGIN).toBeDefined();
		expect(RATE_LIMITS.ADMIN_LOGIN.maxAttempts).toBe(5);
		expect(RATE_LIMITS.ADMIN_LOGIN.windowMs).toBe(15 * 60 * 1000);
	});

	it('should have REGISTRATION configuration', () => {
		expect(RATE_LIMITS.REGISTRATION).toBeDefined();
		expect(RATE_LIMITS.REGISTRATION.maxAttempts).toBe(3);
		expect(RATE_LIMITS.REGISTRATION.windowMs).toBe(60 * 60 * 1000);
	});
});
