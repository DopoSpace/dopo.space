/**
 * Genderize.io Integration Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
	genderizeName,
	genderizeNameRateLimited,
	isGenderizeConfigured,
	_rateLimiter
} from './genderize';

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// Mock the env module
vi.mock('$lib/server/config/env', () => ({
	getGenderizeApiKey: vi.fn(() => undefined)
}));

describe('genderizeName', () => {
	beforeEach(() => {
		mockFetch.mockReset();
	});

	it('should return M for male names with country=IT', async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			json: async () => ({
				name: 'Marco',
				gender: 'male',
				probability: 0.99,
				count: 15234
			})
		});

		const result = await genderizeName('Marco', 'IT');

		expect(result.found).toBe(true);
		expect(result.gender).toBe('M');
		expect(result.probability).toBe(0.99);
		expect(result.count).toBe(15234);
		expect(mockFetch).toHaveBeenCalledWith(
			expect.stringContaining('name=Marco')
		);
		expect(mockFetch).toHaveBeenCalledWith(
			expect.stringContaining('country_id=IT')
		);
	});

	it('should return F for female names', async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			json: async () => ({
				name: 'Maria',
				gender: 'female',
				probability: 0.98,
				count: 28901
			})
		});

		const result = await genderizeName('Maria');

		expect(result.found).toBe(true);
		expect(result.gender).toBe('F');
		expect(result.probability).toBe(0.98);
	});

	it('should return null for unknown names', async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			json: async () => ({
				name: 'Xynthia',
				gender: null,
				probability: 0,
				count: 0
			})
		});

		const result = await genderizeName('Xynthia');

		expect(result.found).toBe(false);
		expect(result.gender).toBeNull();
	});

	it('should handle Andrea as M with country=IT', async () => {
		// Andrea is typically male in Italy but female in other countries
		mockFetch.mockResolvedValueOnce({
			ok: true,
			json: async () => ({
				name: 'Andrea',
				gender: 'male',
				probability: 0.94,
				count: 12456
			})
		});

		const result = await genderizeName('Andrea', 'IT');

		expect(result.found).toBe(true);
		expect(result.gender).toBe('M');
	});

	it('should respect probability threshold (reject below 85%)', async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			json: async () => ({
				name: 'Alex',
				gender: 'male',
				probability: 0.72, // Below 85% threshold
				count: 5000
			})
		});

		const result = await genderizeName('Alex');

		expect(result.found).toBe(false);
		expect(result.gender).toBeNull();
		expect(result.probability).toBe(0.72);
	});

	it('should accept probability at exactly 85%', async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			json: async () => ({
				name: 'Luca',
				gender: 'male',
				probability: 0.85,
				count: 8000
			})
		});

		const result = await genderizeName('Luca');

		expect(result.found).toBe(true);
		expect(result.gender).toBe('M');
	});

	it('should handle API errors gracefully', async () => {
		mockFetch.mockResolvedValueOnce({
			ok: false,
			status: 500
		});

		const result = await genderizeName('Marco');

		expect(result.found).toBe(false);
		expect(result.gender).toBeNull();
	});

	it('should handle rate limit (429) error', async () => {
		mockFetch.mockResolvedValueOnce({
			ok: false,
			status: 429
		});

		const result = await genderizeName('Marco');

		expect(result.found).toBe(false);
		expect(result.error).toBe('Rate limit exceeded');
	});

	it('should handle network errors', async () => {
		mockFetch.mockRejectedValueOnce(new Error('Network error'));

		const result = await genderizeName('Marco');

		expect(result.found).toBe(false);
		expect(result.error).toBe('Network error');
	});

	it('should return not found for empty or short names', async () => {
		const result1 = await genderizeName('');
		expect(result1.found).toBe(false);

		const result2 = await genderizeName('A');
		expect(result2.found).toBe(false);

		// fetch should not have been called
		expect(mockFetch).not.toHaveBeenCalled();
	});

	it('should trim name before sending', async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			json: async () => ({
				name: 'Marco',
				gender: 'male',
				probability: 0.99,
				count: 15234
			})
		});

		await genderizeName('  Marco  ');

		expect(mockFetch).toHaveBeenCalledWith(
			expect.stringContaining('name=Marco')
		);
	});
});

describe('isGenderizeConfigured', () => {
	it('should return true (works without API key)', () => {
		expect(isGenderizeConfigured()).toBe(true);
	});
});

describe('GenderizeRateLimiter', () => {
	beforeEach(() => {
		_rateLimiter.reset();
		mockFetch.mockReset();
	});

	afterEach(() => {
		_rateLimiter.reset();
	});

	it('should allow requests under daily limit', async () => {
		mockFetch.mockResolvedValue({
			ok: true,
			json: async () => ({
				name: 'Marco',
				gender: 'male',
				probability: 0.99,
				count: 15234
			})
		});

		// First request should succeed
		const result = await genderizeNameRateLimited('Marco');
		expect(result.found).toBe(true);

		const stats = _rateLimiter.getStats();
		expect(stats.requestCount).toBe(1);
	});

	it('should block requests over daily limit', async () => {
		mockFetch.mockResolvedValue({
			ok: true,
			json: async () => ({
				name: 'Marco',
				gender: 'male',
				probability: 0.99,
				count: 15234
			})
		});

		// Exhaust the limit (100 requests)
		for (let i = 0; i < 100; i++) {
			await genderizeNameRateLimited('Marco');
		}

		// 101st request should be blocked
		const result = await genderizeNameRateLimited('Marco');

		expect(result.found).toBe(false);
		expect(result.error).toBe('Daily rate limit exceeded');

		// fetch should have been called only 100 times
		expect(mockFetch).toHaveBeenCalledTimes(100);
	});

	it('should track request count correctly', async () => {
		mockFetch.mockResolvedValue({
			ok: true,
			json: async () => ({
				name: 'Marco',
				gender: 'male',
				probability: 0.99,
				count: 15234
			})
		});

		// Make 5 requests
		for (let i = 0; i < 5; i++) {
			await genderizeNameRateLimited('Marco');
		}

		const stats = _rateLimiter.getStats();
		expect(stats.requestCount).toBe(5);
		expect(stats.maxRequests).toBe(100);
	});

	it('should reset after calling reset()', async () => {
		mockFetch.mockResolvedValue({
			ok: true,
			json: async () => ({
				name: 'Marco',
				gender: 'male',
				probability: 0.99,
				count: 15234
			})
		});

		// Make some requests
		for (let i = 0; i < 10; i++) {
			await genderizeNameRateLimited('Marco');
		}

		expect(_rateLimiter.getStats().requestCount).toBe(10);

		// Reset
		_rateLimiter.reset();

		expect(_rateLimiter.getStats().requestCount).toBe(0);
	});
});
