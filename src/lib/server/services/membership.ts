/**
 * Membership Service
 *
 * Business logic for membership management and state transitions.
 */

import { prisma } from '../db/prisma';
import { SystemState, type MembershipSummary } from '$lib/types/membership';
import { MembershipStatus, PaymentStatus } from '@prisma/client';

/**
 * Get membership summary for a user
 * Determines the current system state (S0-S6) and provides relevant information
 */
export async function getMembershipSummary(userId: string): Promise<MembershipSummary> {
	const user = await prisma.user.findUnique({
		where: { id: userId },
		include: {
			profile: true,
			memberships: {
				orderBy: { createdAt: 'desc' },
				take: 1,
				include: {
					associationYear: true
				}
			}
		}
	});

	if (!user) {
		throw new Error('User not found');
	}

	const profile = user.profile;
	const membership = user.memberships[0];

	// Check profile completeness
	const profileComplete =
		!!profile &&
		profile.profileComplete &&
		!!profile.firstName &&
		!!profile.lastName &&
		!!profile.birthDate &&
		!!profile.address &&
		!!profile.city &&
		!!profile.postalCode &&
		!!profile.province &&
		profile.privacyConsent &&
		profile.dataConsent;

	// S0: No membership
	if (!membership) {
		return {
			systemState: SystemState.S0_NO_MEMBERSHIP,
			hasActiveMembership: false,
			membershipNumber: null,
			startDate: null,
			endDate: null,
			profileComplete,
			canPurchase: true,
			message: 'No active membership. Purchase a membership to get started.'
		};
	}

	// S3: Payment failed
	if (membership.paymentStatus === PaymentStatus.FAILED || membership.paymentStatus === PaymentStatus.CANCELED) {
		return {
			systemState: SystemState.S3_PAYMENT_FAILED,
			hasActiveMembership: false,
			membershipNumber: null,
			startDate: membership.startDate,
			endDate: membership.endDate,
			profileComplete,
			canPurchase: true,
			message: 'Payment failed. Please try again.'
		};
	}

	// S1: Profile complete, payment pending
	if (membership.paymentStatus === PaymentStatus.PENDING && profileComplete) {
		return {
			systemState: SystemState.S1_PROFILE_COMPLETE,
			hasActiveMembership: false,
			membershipNumber: null,
			startDate: null,
			endDate: null,
			profileComplete,
			canPurchase: false,
			message: 'Profile complete. Please proceed with payment.'
		};
	}

	// S4: Payment succeeded, awaiting number assignment
	if (membership.paymentStatus === PaymentStatus.SUCCEEDED && !membership.membershipNumber) {
		return {
			systemState: SystemState.S4_AWAITING_NUMBER,
			hasActiveMembership: false,
			membershipNumber: null,
			startDate: membership.startDate,
			endDate: membership.endDate,
			profileComplete,
			canPurchase: false,
			message: 'Payment received! Your membership number will be assigned soon.'
		};
	}

	// S6: Expired membership
	if (membership.endDate && membership.endDate < new Date()) {
		return {
			systemState: SystemState.S6_EXPIRED,
			hasActiveMembership: false,
			membershipNumber: membership.membershipNumber,
			startDate: membership.startDate,
			endDate: membership.endDate,
			profileComplete,
			canPurchase: true,
			message: 'Your membership has expired. Purchase a new membership to continue.'
		};
	}

	// S5: Active membership with number
	if (membership.membershipNumber && membership.status === MembershipStatus.ACTIVE) {
		return {
			systemState: SystemState.S5_ACTIVE,
			hasActiveMembership: true,
			membershipNumber: membership.membershipNumber,
			startDate: membership.startDate,
			endDate: membership.endDate,
			profileComplete,
			canPurchase: false,
			message: `Active membership. Card number: ${membership.membershipNumber}`
		};
	}

	// Default fallback
	return {
		systemState: SystemState.S0_NO_MEMBERSHIP,
		hasActiveMembership: false,
		membershipNumber: null,
		startDate: null,
		endDate: null,
		profileComplete,
		canPurchase: true,
		message: 'Status unknown. Please contact support.'
	};
}

/**
 * Update expired memberships
 * Should be run daily via cron job
 */
export async function updateExpiredMemberships() {
	const now = new Date();

	const result = await prisma.membership.updateMany({
		where: {
			status: MembershipStatus.ACTIVE,
			endDate: {
				lt: now
			}
		},
		data: {
			status: MembershipStatus.EXPIRED
		}
	});

	return result.count;
}

/**
 * Get active association year
 */
export async function getActiveAssociationYear() {
	return await prisma.associationYear.findFirst({
		where: { isActive: true }
	});
}

/**
 * Create a new membership for payment
 */
export async function createMembershipForPayment(userId: string) {
	const associationYear = await getActiveAssociationYear();

	if (!associationYear) {
		throw new Error('No active association year found');
	}

	// Check if user already has a pending or active membership
	const existingMembership = await prisma.membership.findFirst({
		where: {
			userId,
			OR: [
				{ status: MembershipStatus.ACTIVE },
				{ paymentStatus: PaymentStatus.PENDING },
				{ paymentStatus: PaymentStatus.SUCCEEDED }
			]
		}
	});

	if (existingMembership) {
		throw new Error('User already has a pending or active membership');
	}

	return await prisma.membership.create({
		data: {
			userId,
			associationYearId: associationYear.id,
			status: MembershipStatus.PENDING,
			paymentStatus: PaymentStatus.PENDING,
			paymentAmount: associationYear.membershipFee
		}
	});
}
