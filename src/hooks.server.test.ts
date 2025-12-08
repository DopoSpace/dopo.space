/**
 * Tests for SvelteKit Server Hooks
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock environment config
vi.mock('$lib/server/config/env', () => ({}));

// Mock verifySessionToken
const mockVerifySessionToken = vi.fn();
vi.mock('$lib/server/auth/magic-link', () => ({
	verifySessionToken: mockVerifySessionToken
}));

// Mock Prisma
const mockPrisma = {
	admin: {
		findUnique: vi.fn()
	},
	user: {
		findUnique: vi.fn()
	}
};

vi.mock('$lib/server/db/prisma', () => ({
	prisma: mockPrisma
}));

// Import after mocks
const { handle } = await import('./hooks.server');

describe('SvelteKit Server Hooks', () => {
	// Helper to create mock event
	const createMockEvent = (pathname: string, sessionCookie?: string) => {
		const cookies = new Map();
		if (sessionCookie) {
			cookies.set('session', sessionCookie);
		}

		return {
			url: { pathname },
			cookies: {
				get: (name: string) => cookies.get(name),
				delete: vi.fn((name: string) => cookies.delete(name))
			},
			locals: {} as App.Locals
		};
	};

	// Mock resolve function
	const mockResolve = vi.fn();

	beforeEach(() => {
		vi.clearAllMocks();
		mockResolve.mockResolvedValue(new Response('OK'));
	});

	describe('Session Token Verification', () => {
		it('should proceed without user/admin when no session cookie', async () => {
			const event = createMockEvent('/');

			await handle({ event, resolve: mockResolve } as any);

			expect(mockVerifySessionToken).not.toHaveBeenCalled();
			expect(mockResolve).toHaveBeenCalledWith(event);
		});

		it('should call verifySessionToken when session cookie exists', async () => {
			const event = createMockEvent('/', 'test-token');
			mockVerifySessionToken.mockReturnValue(null);

			await handle({ event, resolve: mockResolve } as any);

			expect(mockVerifySessionToken).toHaveBeenCalledWith('test-token');
		});
	});

	describe('Admin Session Handling', () => {
		it('should load admin when token has role=admin', async () => {
			const event = createMockEvent('/admin/dashboard', 'admin-token');
			mockVerifySessionToken.mockReturnValue({
				userId: 'admin-123',
				role: 'admin',
				issuedAt: new Date('2024-01-01')
			});
			mockPrisma.admin.findUnique.mockResolvedValue({
				id: 'admin-123',
				email: 'admin@test.com',
				sessionsInvalidatedAt: null
			});

			await handle({ event, resolve: mockResolve } as any);

			expect(mockPrisma.admin.findUnique).toHaveBeenCalledWith({
				where: { id: 'admin-123' }
			});
			expect(event.locals.admin).toBeDefined();
		});
	});

	describe('Route Protection - Admin Routes', () => {
		it('should allow /admin/login without authentication', async () => {
			const event = createMockEvent('/admin/login');

			await handle({ event, resolve: mockResolve } as any);

			expect(mockResolve).toHaveBeenCalled();
		});

		it('should redirect /admin to /admin/login when not authenticated', async () => {
			const event = createMockEvent('/admin');

			const response = await handle({ event, resolve: mockResolve } as any);

			expect(response.status).toBe(302);
			expect(response.headers.get('location')).toBe('/admin/login');
		});
	});
});
