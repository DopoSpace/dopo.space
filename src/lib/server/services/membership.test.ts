/**
 * Tests for membership service
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SystemState } from '$lib/types/membership';

// Mock Prisma
const mockPrisma = {
	user: {
		findUnique: vi.fn()
	},
	membership: {
		findFirst: vi.fn(),
		updateMany: vi.fn(),
		create: vi.fn()
	},
	associationYear: {
		findFirst: vi.fn()
	}
};

vi.mock('$lib/server/db/prisma', () => ({
	prisma: mockPrisma
}));

// Import after mocking
const { getMembershipSummary, getActiveAssociationYear, createMembershipForPayment } = await import(
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
						endDate: new Date('2025-12-31'),
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

	describe('getActiveAssociationYear', () => {
		it('should return active association year', async () => {
			const mockYear = {
				id: 'year-1',
				startDate: new Date('2025-01-01'),
				endDate: new Date('2025-12-31'),
				membershipFee: 2500,
				isActive: true
			};

			mockPrisma.associationYear.findFirst.mockResolvedValue(mockYear);

			const result = await getActiveAssociationYear();

			expect(result).toEqual(mockYear);
			expect(mockPrisma.associationYear.findFirst).toHaveBeenCalledWith({
				where: { isActive: true }
			});
		});

		it('should return null if no active year', async () => {
			mockPrisma.associationYear.findFirst.mockResolvedValue(null);

			const result = await getActiveAssociationYear();

			expect(result).toBeNull();
		});
	});

	describe('createMembershipForPayment', () => {
		it('should create membership with active year', async () => {
			const mockYear = {
				id: 'year-1',
				startDate: new Date('2025-01-01'),
				endDate: new Date('2025-12-31'),
				membershipFee: 2500,
				isActive: true
			};

			mockPrisma.associationYear.findFirst.mockResolvedValue(mockYear);
			mockPrisma.membership.findFirst.mockResolvedValue(null);
			mockPrisma.membership.create.mockResolvedValue({
				id: 'membership-1',
				userId: 'user-1',
				associationYearId: 'year-1',
				status: 'PENDING',
				paymentStatus: 'PENDING',
				paymentAmount: 2500
			});

			const result = await createMembershipForPayment('user-1');

			expect(result).toBeTruthy();
			expect(mockPrisma.membership.create).toHaveBeenCalledWith({
				data: {
					userId: 'user-1',
					associationYearId: 'year-1',
					status: 'PENDING',
					paymentStatus: 'PENDING',
					paymentAmount: 2500
				}
			});
		});

		it('should throw error if no active year', async () => {
			mockPrisma.associationYear.findFirst.mockResolvedValue(null);

			await expect(createMembershipForPayment('user-1')).rejects.toThrow(
				'No active association year found'
			);
		});

		it('should throw error if user has existing membership', async () => {
			const mockYear = {
				id: 'year-1',
				membershipFee: 2500,
				isActive: true
			};

			mockPrisma.associationYear.findFirst.mockResolvedValue(mockYear);
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
