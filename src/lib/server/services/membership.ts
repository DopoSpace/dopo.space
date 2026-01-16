/**
 * Membership Service
 *
 * Business logic for membership management and state transitions.
 */

import { prisma } from '../db/prisma';
import type { Prisma } from '@prisma/client';
import { SystemState, type MembershipSummary } from '$lib/types/membership';
import { MembershipStatus, PaymentStatus } from '@prisma/client';
import { getAvailableNumbers, getAvailableNumbersWithTx } from './card-ranges';
import { getMembershipFee } from './settings';
import pino from 'pino';

const logger = pino({ name: 'membership' });

/**
 * Membership duration in days (rolling membership)
 */
const MEMBERSHIP_DURATION_DAYS = 365;

/**
 * Result of batch membership number assignment
 */
export interface BatchAssignResult {
	assigned: { userId: string; email: string; membershipNumber: string }[];
	skipped: string[]; // numeri già esistenti nel DB
	remaining: string[]; // tessere non assegnate (avanzate)
	usersWithoutCard: { userId: string; email: string }[]; // utenti non assegnati (tessere insufficienti)
}

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
				take: 1
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
		!!profile.privacyConsent &&
		!!profile.dataConsent;

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

	// S2: Payment in progress (has paymentProviderId but payment not yet succeeded/failed)
	// This state occurs when user is redirected to PayPal but hasn't completed payment yet
	if (
		membership.paymentStatus === PaymentStatus.PENDING &&
		membership.paymentProviderId &&
		!membership.membershipNumber
	) {
		return {
			systemState: SystemState.S2_PROCESSING_PAYMENT,
			hasActiveMembership: false,
			membershipNumber: null,
			startDate: null,
			endDate: null,
			profileComplete,
			canPurchase: false,
			message: 'Payment in progress. Please complete payment on PayPal.'
		};
	}

	// S1: Profile complete, payment pending (not yet started)
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

	// Profile incomplete with pending membership - user needs to complete profile first
	if (membership.paymentStatus === PaymentStatus.PENDING && !profileComplete) {
		return {
			systemState: SystemState.S0_NO_MEMBERSHIP,
			hasActiveMembership: false,
			membershipNumber: null,
			startDate: null,
			endDate: null,
			profileComplete: false,
			canPurchase: false, // Already has pending membership
			message: 'Complete your profile to proceed with payment.'
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

	// S5: Active membership with number and not expired
	// Must check both status and expiry date to properly distinguish from S6
	const isExpired = membership.endDate && membership.endDate < new Date();
	if (
		membership.membershipNumber &&
		membership.status === MembershipStatus.ACTIVE &&
		!isExpired
	) {
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

	// S6: Expired membership (must have had membershipNumber assigned - was previously active)
	if (membership.membershipNumber && membership.endDate && membership.endDate < new Date()) {
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

	// Default fallback - this should NEVER happen in normal operation
	// Log as error for investigation
	logger.error({
		userId,
		membershipId: membership.id,
		membershipStatus: membership.status,
		paymentStatus: membership.paymentStatus,
		membershipNumber: membership.membershipNumber,
		startDate: membership.startDate,
		endDate: membership.endDate
	}, 'CRITICAL: Membership reached unknown state - state machine logic error');

	return {
		systemState: SystemState.S0_NO_MEMBERSHIP,
		hasActiveMembership: false,
		membershipNumber: membership.membershipNumber || null,
		startDate: membership.startDate,
		endDate: membership.endDate,
		profileComplete,
		canPurchase: false, // Do NOT allow purchase in unknown state
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
 * Calculate membership end date from start date
 */
export function calculateEndDate(startDate: Date): Date {
	const endDate = new Date(startDate);
	endDate.setDate(endDate.getDate() + MEMBERSHIP_DURATION_DAYS);
	return endDate;
}

/**
 * Create a new membership for payment
 * Uses transaction to prevent race conditions
 */
export async function createMembershipForPayment(userId: string) {
	const fee = await getMembershipFee();

	// Use transaction to atomically check and create
	return await prisma.$transaction(async (tx) => {
		// Check if user already has a pending or active membership
		const existingMembership = await tx.membership.findFirst({
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

		return await tx.membership.create({
			data: {
				userId,
				status: MembershipStatus.PENDING,
				paymentStatus: PaymentStatus.PENDING,
				paymentAmount: fee
			}
		});
	});
}

/**
 * Generate sequential membership numbers
 * @param prefix - Optional prefix (e.g., "DOPO-", "2024/")
 * @param start - Start number as string (e.g., "001", "10")
 * @param end - End number as string (e.g., "050", "100")
 * @returns Array of formatted membership numbers
 */
function generateSequentialNumbers(prefix: string, start: string, end: string): string[] {
	const numbers: string[] = [];
	const startNum = parseInt(start, 10);
	const endNum = parseInt(end, 10);
	const padding = start.length;

	for (let i = startNum; i <= endNum; i++) {
		const num = i.toString().padStart(padding, '0');
		numbers.push(prefix + num);
	}

	return numbers;
}

/** Transaction client type for Prisma */
type TransactionClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

/** User with membership for assignment */
interface UserWithMembership {
	id: string;
	email: string;
	memberships: { id: string }[];
}

/**
 * Fetch users in S4 state (payment succeeded, awaiting card assignment)
 */
async function fetchUsersInS4State(tx: TransactionClient, userIds: string[]) {
	return tx.user.findMany({
		where: {
			id: { in: userIds },
			memberships: {
				some: {
					paymentStatus: PaymentStatus.SUCCEEDED,
					membershipNumber: null
				}
			}
		},
		include: {
			memberships: {
				where: {
					paymentStatus: PaymentStatus.SUCCEEDED,
					membershipNumber: null
				},
				orderBy: { createdAt: 'desc' },
				take: 1
			}
		},
		orderBy: { createdAt: 'asc' }
	});
}

/**
 * Core logic for assigning membership numbers to users
 * Shared between batch and auto assignment functions
 */
async function assignNumbersToUsers(
	tx: TransactionClient,
	users: UserWithMembership[],
	availableNumbers: string[],
	logContext: string
): Promise<{
	assigned: { userId: string; email: string; membershipNumber: string }[];
	usersWithoutCard: { userId: string; email: string }[];
	numberIndex: number;
}> {
	const assigned: { userId: string; email: string; membershipNumber: string }[] = [];
	const usersWithoutCard: { userId: string; email: string }[] = [];
	let numberIndex = 0;

	for (const user of users) {
		if (numberIndex >= availableNumbers.length) {
			usersWithoutCard.push({ userId: user.id, email: user.email });
			continue;
		}

		const membership = user.memberships[0];
		if (!membership) {
			logger.warn(
				{ userId: user.id, email: user.email },
				`User matched S4 query but has no membership in ${logContext} - possible race condition`
			);
			usersWithoutCard.push({ userId: user.id, email: user.email });
			continue;
		}

		const membershipNumber = availableNumbers[numberIndex];
		numberIndex++;

		const startDate = new Date();
		const endDate = calculateEndDate(startDate);

		await tx.membership.update({
			where: { id: membership.id },
			data: {
				membershipNumber,
				status: MembershipStatus.ACTIVE,
				startDate,
				endDate,
				cardAssignedAt: new Date()
			}
		});

		assigned.push({ userId: user.id, email: user.email, membershipNumber });
	}

	return { assigned, usersWithoutCard, numberIndex };
}

/**
 * Batch assign membership numbers to multiple users
 * Uses transaction to ensure atomicity and prevent duplicate assignments
 * @param prefix - Optional prefix for membership numbers
 * @param startNumber - Starting number (as string to preserve padding)
 * @param endNumber - Ending number (as string)
 * @param userIds - Array of user IDs to assign numbers to
 * @returns BatchAssignResult with assigned, skipped, remaining, and usersWithoutCard
 */
export async function batchAssignMembershipNumbers(
	prefix: string,
	startNumber: string,
	endNumber: string,
	userIds: string[]
): Promise<BatchAssignResult> {
	const allNumbers = generateSequentialNumbers(prefix, startNumber, endNumber);

	return await prisma.$transaction(async (tx) => {
		// Find which numbers already exist in the database
		const existingMemberships = await tx.membership.findMany({
			where: { membershipNumber: { in: allNumbers } },
			select: { membershipNumber: true }
		});

		const existingNumbers = new Set(existingMemberships.map((m) => m.membershipNumber));
		const skipped = allNumbers.filter((num) => existingNumbers.has(num));
		const availableNumbers = allNumbers.filter((num) => !existingNumbers.has(num));

		const users = await fetchUsersInS4State(tx, userIds);
		const { assigned, usersWithoutCard, numberIndex } = await assignNumbersToUsers(
			tx,
			users,
			availableNumbers,
			'batchAssign'
		);

		return {
			assigned,
			skipped,
			remaining: availableNumbers.slice(numberIndex),
			usersWithoutCard
		};
	});
}

/**
 * Get users awaiting card assignment (S4 state)
 * These are users with payment succeeded but no membership number assigned
 */
export async function getUsersAwaitingCard() {
	try {
		return await prisma.user.findMany({
			where: {
				memberships: {
					some: {
						paymentStatus: PaymentStatus.SUCCEEDED,
						membershipNumber: null
					}
				}
			},
			include: {
				profile: {
					select: {
						firstName: true,
						lastName: true
					}
				},
				memberships: {
					where: {
						paymentStatus: PaymentStatus.SUCCEEDED,
						membershipNumber: null
					},
					orderBy: { createdAt: 'desc' },
					take: 1,
					select: {
						id: true,
						createdAt: true
					}
				}
			},
			orderBy: { createdAt: 'asc' } // FIFO order
		});
	} catch (error) {
		logger.error({ err: error }, 'Failed to fetch users awaiting card assignment');
		throw new Error('Database error fetching pending card assignments');
	}
}

/**
 * Result of automatic card assignment
 */
export interface AutoAssignResult {
	assigned: { userId: string; email: string; membershipNumber: string }[];
	usersWithoutCard: { userId: string; email: string }[];
	availableCount: number;
	requestedCount: number;
}

/**
 * Automatically assign membership numbers from configured ranges
 * Uses FIFO order (first paid = first assigned)
 * Uses transaction to ensure atomicity and prevent race conditions
 */
export async function autoAssignMembershipNumbers(userIds: string[]): Promise<AutoAssignResult> {
	return await prisma.$transaction(async (tx) => {
		const availableNumbers = await getAvailableNumbersWithTx(tx);

		if (availableNumbers.length === 0) {
			throw new Error('Nessun numero disponibile. Configura i range delle tessere in /admin/card-ranges');
		}

		const users = await fetchUsersInS4State(tx, userIds);
		const { assigned, usersWithoutCard } = await assignNumbersToUsers(
			tx,
			users,
			availableNumbers,
			'autoAssign'
		);

		return {
			assigned,
			usersWithoutCard,
			availableCount: availableNumbers.length,
			requestedCount: userIds.length
		};
	});
}

/**
 * Check if user is renewing (has previous membership with card number)
 */
export async function checkUserRenewalStatus(userId: string): Promise<{
	isRenewal: boolean;
	previousNumber: string | null;
}> {
	const previousMembership = await prisma.membership.findFirst({
		where: {
			userId,
			membershipNumber: { not: null }
		},
		orderBy: { createdAt: 'desc' },
		select: {
			membershipNumber: true,
			endDate: true
		}
	});

	if (!previousMembership) {
		return { isRenewal: false, previousNumber: null };
	}

	return {
		isRenewal: true,
		previousNumber: previousMembership.membershipNumber
	};
}

/**
 * Create membership with automatic number conservation for renewals
 * Uses rolling 365-day membership dates
 */
export async function createMembershipWithRenewal(
	userId: string
): Promise<{ membership: unknown; isRenewal: boolean; conservedNumber: string | null }> {
	// Check if this is a renewal
	const renewalStatus = await checkUserRenewalStatus(userId);

	// If renewal, use the previous number
	const membershipNumber = renewalStatus.isRenewal ? renewalStatus.previousNumber : null;
	const status = membershipNumber ? MembershipStatus.ACTIVE : MembershipStatus.PENDING;

	// Get membership fee from settings
	const fee = await getMembershipFee();

	// Calculate rolling 365-day dates
	const startDate = new Date();
	const endDate = calculateEndDate(startDate);

	const membership = await prisma.membership.create({
		data: {
			userId,
			membershipNumber,
			status,
			paymentStatus: PaymentStatus.SUCCEEDED,
			paymentAmount: fee,
			startDate,
			endDate,
			// If renewing with a previous number, set cardAssignedAt to now
			cardAssignedAt: membershipNumber ? new Date() : null
		}
	});

	return {
		membership,
		isRenewal: renewalStatus.isRenewal,
		conservedNumber: membershipNumber
	};
}
