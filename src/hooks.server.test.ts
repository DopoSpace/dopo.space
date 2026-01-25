/**
 * Tests for SvelteKit Server Hooks
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock environment config with domain functions
vi.mock('$lib/server/config/env', () => ({
	getMainDomain: () => 'lvh.me:5173',
	getAdminSubdomain: () => 'admin',
	getAdminDomain: () => 'admin.lvh.me:5173'
}));

// Mock constants with new cookie names
vi.mock('$lib/server/config/constants', () => ({
	USER_SESSION_COOKIE_NAME: 'user_session',
	ADMIN_SESSION_COOKIE_NAME: 'admin_session'
}));

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

// Mock Paraglide server to avoid AsyncLocalStorage issues in tests
vi.mock('$lib/paraglide/server.js', () => ({
	paraglideMiddleware: vi.fn((_request, handler) => handler())
}));

// Mock Paraglide runtime
vi.mock('$lib/paraglide/runtime.js', () => ({
	locales: ['it', 'en'] as const
}));

// Mock SvelteKit sequence to avoid AsyncLocalStorage issues
// This implements sequence by chaining handlers - each handler's resolve calls the next handler
vi.mock('@sveltejs/kit/hooks', () => ({
	sequence: (...handlers: any[]) => {
		return async (input: any) => {
			// Create a chain of resolve functions
			// The last resolve in the chain is the original resolve
			let index = handlers.length;

			const createResolve = (i: number): any => {
				if (i >= handlers.length) {
					return input.resolve;
				}
				return (event: any) => {
					return handlers[i]({
						event,
						resolve: createResolve(i + 1)
					});
				};
			};

			// Start with the first handler
			return handlers[0]({
				event: input.event,
				resolve: createResolve(1)
			});
		};
	}
}));

// Import after mocks
const { handle } = await import('./hooks.server');

describe('SvelteKit Server Hooks', () => {
	// Helper to create mock event with subdomain support
	const createMockEvent = (
		pathname: string,
		options: {
			hostname?: string;
			adminSessionCookie?: string;
			userSessionCookie?: string;
		} = {}
	) => {
		const { hostname = 'local', adminSessionCookie, userSessionCookie } = options;
		const cookies = new Map<string, string>();
		if (adminSessionCookie) {
			cookies.set('admin_session', adminSessionCookie);
		}
		if (userSessionCookie) {
			cookies.set('user_session', userSessionCookie);
		}

		return {
			url: {
				pathname,
				hostname
			},
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

	describe('Subdomain Detection', () => {
		it('should set subdomainContext to main for main domain', async () => {
			const event = createMockEvent('/', { hostname: 'lvh.me' });

			await handle({ event, resolve: mockResolve } as any);

			expect(event.locals.subdomainContext).toBe('main');
		});

		it('should set subdomainContext to admin for admin subdomain', async () => {
			const event = createMockEvent('/admin/login', { hostname: 'admin.lvh.me' });

			await handle({ event, resolve: mockResolve } as any);

			expect(event.locals.subdomainContext).toBe('admin');
		});
	});

	describe('Route Protection', () => {
		it('should redirect root path to /admin/login on admin subdomain', async () => {
			const event = createMockEvent('/', { hostname: 'admin.lvh.me' });

			const response = await handle({ event, resolve: mockResolve } as any);

			expect(response.status).toBe(302);
			expect(response.headers.get('location')).toBe('/admin/login');
		});

		it('should redirect /admin/* to admin subdomain when accessed from main domain', async () => {
			const event = createMockEvent('/admin/users', { hostname: 'lvh.me' });

			const response = await handle({ event, resolve: mockResolve } as any);

			expect(response.status).toBe(302);
			expect(response.headers.get('location')).toContain('admin.lvh.me');
		});

		it('should allow /admin/login on admin subdomain without authentication', async () => {
			const event = createMockEvent('/admin/login', { hostname: 'admin.lvh.me' });

			await handle({ event, resolve: mockResolve } as any);

			expect(mockResolve).toHaveBeenCalled();
		});

		it('should redirect /admin to /admin/login on admin subdomain when not authenticated', async () => {
			const event = createMockEvent('/admin/users', { hostname: 'admin.lvh.me' });

			const response = await handle({ event, resolve: mockResolve } as any);

			expect(response.status).toBe(302);
			expect(response.headers.get('location')).toBe('/admin/login');
		});
	});

	describe('Admin Session Handling', () => {
		it('should load admin when valid admin_session cookie exists on admin subdomain', async () => {
			const event = createMockEvent('/admin/users', {
				hostname: 'admin.lvh.me',
				adminSessionCookie: 'admin-token'
			});
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
			expect(mockResolve).toHaveBeenCalled();
		});
	});

	describe('User Session Handling', () => {
		it('should load user when valid user_session cookie exists on main domain', async () => {
			const event = createMockEvent('/membership/dashboard', {
				hostname: 'lvh.me',
				userSessionCookie: 'user-token'
			});
			mockVerifySessionToken.mockReturnValue({
				userId: 'user-123',
				role: 'user',
				issuedAt: new Date('2024-01-01')
			});
			mockPrisma.user.findUnique.mockResolvedValue({
				id: 'user-123',
				email: 'user@test.com',
				sessionsInvalidatedAt: null,
				profile: null,
				memberships: []
			});

			await handle({ event, resolve: mockResolve } as any);

			expect(mockPrisma.user.findUnique).toHaveBeenCalled();
			expect(event.locals.user).toBeDefined();
			expect(mockResolve).toHaveBeenCalled();
		});

		it('should redirect /membership to /auth/login when not authenticated', async () => {
			const event = createMockEvent('/membership/dashboard', { hostname: 'lvh.me' });

			const response = await handle({ event, resolve: mockResolve } as any);

			expect(response.status).toBe(302);
			expect(response.headers.get('location')).toBe('/auth/login');
		});
	});
});
