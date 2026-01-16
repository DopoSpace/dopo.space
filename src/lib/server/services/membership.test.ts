/**
 * Tests for membership service
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SystemState } from '$lib/types/membership';

// Mock Prisma with transaction support
const mockPrisma: any = {
	user: {
		findUnique: vi.fn()
	},
	membership: {
		findFirst: vi.fn(),
		updateMany: vi.fn(),
		create: vi.fn()
	},
	settings: {
		findUnique: vi.fn()
	},
	// Transaction support: calls callback with mockPrisma itself
	$transaction: vi.fn((callback: (tx: any) => Promise<any>) => callback(mockPrisma))
};

vi.mock('$lib/server/db/prisma', () => ({
	prisma: mockPrisma
}));

// Import after mocking
const { getMembershipSummary, createMembershipForPayment, calculateEndDate } = await import(
	'./membership'
);

describe('Membership Service', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe('getMembershipSummary', () => {
		it('should return S0_NO_MEMBERSHIP for user without membership', async () => {
			mockPrisma.user.findUnique.mockResolvedValue({
				id: 'user-1',
				email: 'test@example.com',
				profile: null,
				memberships: []
			});

			const summary = await getMembershipSummary('user-1');

			expect(summary.systemState).toBe(SystemState.S0_NO_MEMBERSHIP);
			expect(summary.hasActiveMembership).toBe(false);
			expect(summary.canPurchase).toBe(true);
		});

		it('should detect incomplete profile', async () => {
			mockPrisma.user.findUnique.mockResolvedValue({
				id: 'user-1',
				email: 'test@example.com',
				profile: {
					firstName: 'John',
					lastName: 'Doe',
					birthDate: null, // Missing required field
					address: null,
					city: null,
					postalCode: null,
					province: null,
					privacyConsent: null,
					dataConsent: null,
					profileComplete: false
				},
				memberships: []
			});

			const summary = await getMembershipSummary('user-1');

			expect(summary.profileComplete).toBe(false);
		});

		it('should detect complete profile', async () => {
			mockPrisma.user.findUnique.mockResolvedValue({
				id: 'user-1',
				email: 'test@example.com',
				profile: {
					firstName: 'John',
					lastName: 'Doe',
					birthDate: new Date('1990-01-01'),
					address: '123 Main St',
					city: 'Milan',
					postalCode: '20100',
					province: 'MI',
					privacyConsent: true,
					dataConsent: true,
					profileComplete: true
				},
				memberships: []
			});

			const summary = await getMembershipSummary('user-1');

			expect(summary.profileComplete).toBe(true);
		});

		it('should return S5_ACTIVE for active membership with number', async () => {
			// Use future end date to ensure membership is not expired
			const futureEndDate = new Date();
			futureEndDate.setFullYear(futureEndDate.getFullYear() + 1);

			mockPrisma.user.findUnique.mockResolvedValue({
				id: 'user-1',
				email: 'test@example.com',
				profile: {
					firstName: 'John',
					lastName: 'Doe',
					birthDate: new Date('1990-01-01'),
					address: '123 Main St',
					city: 'Milan',
					postalCode: '20100',
					province: 'MI',
					privacyConsent: true,
					dataConsent: true,
					profileComplete: true
				},
				memberships: [
					{
						id: 'membership-1',
						status: 'ACTIVE',
						paymentStatus: 'SUCCEEDED',
						membershipNumber: 'DS-2025-001',
						startDate: new Date('2025-01-01'),
						endDate: futureEndDate,
						createdAt: new Date()
					}
				]
			});

			const summary = await getMembershipSummary('user-1');

			expect(summary.systemState).toBe(SystemState.S5_ACTIVE);
			expect(summary.hasActiveMembership).toBe(true);
			expect(summary.membershipNumber).toBe('DS-2025-001');
			expect(summary.canPurchase).toBe(false);
		});

		it('should return S6_EXPIRED for expired membership', async () => {
			const pastDate = new Date();
			pastDate.setFullYear(pastDate.getFullYear() - 1);

			mockPrisma.user.findUnique.mockResolvedValue({
				id: 'user-1',
				email: 'test@example.com',
				profile: {
					firstName: 'John',
					lastName: 'Doe',
					profileComplete: true,
					birthDate: new Date('1990-01-01'),
					address: '123 Main St',
					city: 'Milan',
					postalCode: '20100',
					province: 'MI',
					privacyConsent: true,
					dataConsent: true
				},
				memberships: [
					{
						id: 'membership-1',
						status: 'ACTIVE',
						paymentStatus: 'SUCCEEDED',
						membershipNumber: 'DS-2024-001',
						startDate: new Date(2024, 0, 1),
						endDate: pastDate,
						createdAt: new Date()
					}
				]
			});

			const summary = await getMembershipSummary('user-1');

			expect(summary.systemState).toBe(SystemState.S6_EXPIRED);
			expect(summary.hasActiveMembership).toBe(false);
			expect(summary.canPurchase).toBe(true);
		});
	});

	describe('calculateEndDate', () => {
		it('should return date 365 days after start date', () => {
			const startDate = new Date('2025-01-15');
			const endDate = calculateEndDate(startDate);

			// 365 days after 2025-01-15 is 2026-01-15
			expect(endDate.getFullYear()).toBe(2026);
			expect(endDate.getMonth()).toBe(0); // January
			expect(endDate.getDate()).toBe(15);
		});

		it('should handle leap years', () => {
			// 2024 is a leap year
			const startDate = new Date('2024-02-29');
			const endDate = calculateEndDate(startDate);

			// 365 days after 2024-02-29 is 2025-02-28
			expect(endDate.getFullYear()).toBe(2025);
			expect(endDate.getMonth()).toBe(1); // February
			expect(endDate.getDate()).toBe(28);
		});
	});

	describe('createMembershipForPayment', () => {
		it('should create membership with fee from settings', async () => {
			mockPrisma.settings.findUnique.mockResolvedValue({
				key: 'MEMBERSHIP_FEE',
				value: '2500'
			});
			mockPrisma.membership.findFirst.mockResolvedValue(null);
			mockPrisma.membership.create.mockResolvedValue({
				id: 'membership-1',
				userId: 'user-1',
				status: 'PENDING',
				paymentStatus: 'PENDING',
				paymentAmount: 2500
			});

			const result = await createMembershipForPayment('user-1');

			expect(result).toBeTruthy();
			expect(mockPrisma.membership.create).toHaveBeenCalledWith({
				data: {
					userId: 'user-1',
					status: 'PENDING',
					paymentStatus: 'PENDING',
					paymentAmount: 2500
				}
			});
		});

		it('should use default fee if settings not found', async () => {
			mockPrisma.settings.findUnique.mockResolvedValue(null);
			mockPrisma.membership.findFirst.mockResolvedValue(null);
			mockPrisma.membership.create.mockResolvedValue({
				id: 'membership-1',
				userId: 'user-1',
				status: 'PENDING',
				paymentStatus: 'PENDING',
				paymentAmount: 2500 // default fee
			});

			const result = await createMembershipForPayment('user-1');

			expect(result).toBeTruthy();
			// Should use default 2500 cents (€25.00)
			expect(mockPrisma.membership.create).toHaveBeenCalledWith({
				data: expect.objectContaining({
					paymentAmount: 2500
				})
			});
		});

		it('should throw error if user has existing membership', async () => {
			mockPrisma.settings.findUnique.mockResolvedValue({
				key: 'MEMBERSHIP_FEE',
				value: '2500'
			});
			mockPrisma.membership.findFirst.mockResolvedValue({
				id: 'existing-membership',
				status: 'ACTIVE'
			});

			await expect(createMembershipForPayment('user-1')).rejects.toThrow(
				'User already has a pending or active membership'
			);
		});
	});
});
