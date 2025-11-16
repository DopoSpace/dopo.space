/**
 * Tests for magic-link authentication
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
	generateMagicLinkToken,
	verifyMagicLinkToken,
	generateSessionToken,
	verifySessionToken
} from './magic-link';

// Mock environment variables
vi.mock('$env/static/private', () => ({
	JWT_SECRET: 'test-secret-key-for-testing-only-minimum-32-chars'
}));

// Mock Prisma database
vi.mock('$lib/server/db/prisma', () => ({
	prisma: {
		usedToken: {
			findUnique: vi.fn().mockResolvedValue(null),
			create: vi.fn().mockResolvedValue({
				id: 'mock-id',
				tokenId: 'mock-token-id',
				tokenType: 'magic_link',
				email: 'test@example.com',
				usedAt: new Date(),
				expiresAt: new Date(Date.now() + 15 * 60 * 1000)
			})
		}
	}
}));

describe('Magic Link Authentication', () => {
	describe('generateMagicLinkToken', () => {
		it('should generate a valid JWT token', () => {
			const email = 'test@example.com';
			const token = generateMagicLinkToken(email);

			expect(token).toBeTruthy();
			expect(typeof token).toBe('string');
			expect(token.split('.')).toHaveLength(3); // JWT has 3 parts
		});

		it('should normalize email to lowercase', async () => {
			const email = 'Test@Example.COM';
			const token = generateMagicLinkToken(email);
			const decoded = await verifyMagicLinkToken(token);

			expect(decoded).toBeTruthy();
			expect(decoded?.email).toBe('test@example.com');
		});

		it('should trim whitespace from email', async () => {
			const email = '  test@example.com  ';
			const token = generateMagicLinkToken(email);
			const decoded = await verifyMagicLinkToken(token);

			expect(decoded?.email).toBe('test@example.com');
		});
	});

	describe('verifyMagicLinkToken', () => {
		it('should verify a valid token', async () => {
			const email = 'test@example.com';
			const token = generateMagicLinkToken(email);
			const result = await verifyMagicLinkToken(token);

			expect(result).toBeTruthy();
			expect(result?.email).toBe(email);
		});

		it('should return null for invalid token', async () => {
			const result = await verifyMagicLinkToken('invalid-token');
			expect(result).toBeNull();
		});

		it('should return null for tampered token', async () => {
			const email = 'test@example.com';
			const token = generateMagicLinkToken(email);
			const tamperedToken = token.slice(0, -5) + 'xxxxx';
			const result = await verifyMagicLinkToken(tamperedToken);

			expect(result).toBeNull();
		});

		it('should reject token with wrong type', async () => {
			// Create a session token (wrong type)
			const sessionToken = generateSessionToken('user-id', 'test@example.com');
			const result = await verifyMagicLinkToken(sessionToken);

			expect(result).toBeNull();
		});
	});

	describe('generateSessionToken', () => {
		it('should generate a valid session token', () => {
			const userId = 'user-123';
			const email = 'test@example.com';
			const token = generateSessionToken(userId, email);

			expect(token).toBeTruthy();
			expect(typeof token).toBe('string');
			expect(token.split('.')).toHaveLength(3);
		});

		it('should include role in token', () => {
			const userId = 'admin-123';
			const email = 'admin@example.com';
			const token = generateSessionToken(userId, email, 'admin');
			const decoded = verifySessionToken(token);

			expect(decoded).toBeTruthy();
			expect(decoded?.role).toBe('admin');
		});

		it('should default to user role', () => {
			const userId = 'user-123';
			const email = 'test@example.com';
			const token = generateSessionToken(userId, email);
			const decoded = verifySessionToken(token);

			expect(decoded?.role).toBe('user');
		});
	});

	describe('verifySessionToken', () => {
		it('should verify a valid session token', () => {
			const userId = 'user-123';
			const email = 'test@example.com';
			const token = generateSessionToken(userId, email);
			const result = verifySessionToken(token);

			expect(result).toBeTruthy();
			expect(result?.userId).toBe(userId);
			expect(result?.email).toBe(email);
			expect(result?.role).toBe('user');
		});

		it('should return null for invalid token', () => {
			const result = verifySessionToken('invalid-token');
			expect(result).toBeNull();
		});

		it('should reject magic link token (wrong type)', () => {
			const magicToken = generateMagicLinkToken('test@example.com');
			const result = verifySessionToken(magicToken);

			expect(result).toBeNull();
		});

		it('should handle legacy tokens without role', () => {
			// This tests backward compatibility
			const userId = 'user-123';
			const email = 'test@example.com';
			const token = generateSessionToken(userId, email);
			const result = verifySessionToken(token);

			expect(result).toBeTruthy();
			expect(result?.role).toBe('user'); // Should default to 'user'
		});
	});
});
