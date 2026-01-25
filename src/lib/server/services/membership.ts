/**
 * Membership Service
 *
 * Business logic for membership management and state transitions.
 */

import { prisma } from '../db/prisma';
import type { Prisma } from '@prisma/client';
import { SystemState, SystemStateLabels, type MembershipSummary } from '$lib/types/membership';
import { MembershipStatus, PaymentStatus } from '@prisma/client';
import {
	getAvailableNumbersWithTx,
	isNumberInConfiguredRangesWithTx,
	validateRangeAgainstConfigured
} from './card-ranges';
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
	assigned: { userId: string; email: string; membershipNumber: string; firstName: string; endDate: Date }[];
	skipped: string[]; // numeri già esistenti nel DB
	remaining: string[]; // tessere non assegnate (avanzate)
	usersWithoutCard: { userId: string; email: string }[]; // utenti non assegnati (tessere insufficienti)
}

/**
 * Get membership summary for a user
 * Determines the current system state (S0-S7) and provides relevant information
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
		const state = SystemState.S0_NO_MEMBERSHIP;
		return {
			systemState: state,
			italianLabel: SystemStateLabels[state],
			hasActiveMembership: false,
			membershipNumber: null,
			previousMembershipNumber: null,
			startDate: null,
			endDate: null,
			profileComplete,
			canPurchase: true,
			message: 'No active membership. Purchase a membership to get started.'
		};
	}

	// S7: Canceled by admin
	if (membership.status === MembershipStatus.CANCELED) {
		const state = SystemState.S7_CANCELED;
		return {
			systemState: state,
			italianLabel: SystemStateLabels[state],
			hasActiveMembership: false,
			membershipNumber: null,
			previousMembershipNumber: membership.previousMembershipNumber,
			startDate: null,
			endDate: null,
			profileComplete,
			canPurchase: true,
			message: 'Your membership has been canceled. Contact support for more information.'
		};
	}

	// S6: Expired membership (status = EXPIRED)
	if (membership.status === MembershipStatus.EXPIRED) {
		const state = SystemState.S6_EXPIRED;
		return {
			systemState: state,
			italianLabel: SystemStateLabels[state],
			hasActiveMembership: false,
			membershipNumber: null,
			previousMembershipNumber: membership.previousMembershipNumber,
			startDate: null,
			endDate: null,
			profileComplete,
			canPurchase: true,
			message: 'Your membership has expired. Purchase a new membership to continue.'
		};
	}

	// S3: Payment failed
	if (membership.paymentStatus === PaymentStatus.FAILED || membership.paymentStatus === PaymentStatus.CANCELED) {
		const state = SystemState.S3_PAYMENT_FAILED;
		return {
			systemState: state,
			italianLabel: SystemStateLabels[state],
			hasActiveMembership: false,
			membershipNumber: null,
			previousMembershipNumber: membership.previousMembershipNumber,
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
		const state = SystemState.S2_PROCESSING_PAYMENT;
		return {
			systemState: state,
			italianLabel: SystemStateLabels[state],
			hasActiveMembership: false,
			membershipNumber: null,
			previousMembershipNumber: membership.previousMembershipNumber,
			startDate: null,
			endDate: null,
			profileComplete,
			canPurchase: false,
			message: 'Payment in progress. Please complete payment on PayPal.'
		};
	}

	// S1: Profile complete, payment pending (not yet started)
	if (membership.paymentStatus === PaymentStatus.PENDING && profileComplete) {
		const state = SystemState.S1_PROFILE_COMPLETE;
		return {
			systemState: state,
			italianLabel: SystemStateLabels[state],
			hasActiveMembership: false,
			membershipNumber: null,
			previousMembershipNumber: membership.previousMembershipNumber,
			startDate: null,
			endDate: null,
			profileComplete,
			canPurchase: false,
			message: 'Profile complete. Please proceed with payment.'
		};
	}

	// Profile incomplete with pending membership - user needs to complete profile first
	if (membership.paymentStatus === PaymentStatus.PENDING && !profileComplete) {
		const state = SystemState.S0_NO_MEMBERSHIP;
		return {
			systemState: state,
			italianLabel: SystemStateLabels[state],
			hasActiveMembership: false,
			membershipNumber: null,
			previousMembershipNumber: membership.previousMembershipNumber,
			startDate: null,
			endDate: null,
			profileComplete: false,
			canPurchase: false, // Already has pending membership
			message: 'Complete your profile to proceed with payment.'
		};
	}

	// S4: Payment succeeded, awaiting number assignment
	if (membership.paymentStatus === PaymentStatus.SUCCEEDED && !membership.membershipNumber) {
		const state = SystemState.S4_AWAITING_NUMBER;
		return {
			systemState: state,
			italianLabel: SystemStateLabels[state],
			hasActiveMembership: false,
			membershipNumber: null,
			previousMembershipNumber: membership.previousMembershipNumber,
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
		const state = SystemState.S5_ACTIVE;
		return {
			systemState: state,
			italianLabel: SystemStateLabels[state],
			hasActiveMembership: true,
			membershipNumber: membership.membershipNumber,
			previousMembershipNumber: membership.previousMembershipNumber,
			startDate: membership.startDate,
			endDate: membership.endDate,
			profileComplete,
			canPurchase: false,
			message: `Active membership. Card number: ${membership.membershipNumber}`
		};
	}

	// S6: Expired membership by date (endDate < now but status not yet updated)
	// This is a transitional state before the scheduled job runs
	if (membership.membershipNumber && membership.endDate && membership.endDate < new Date()) {
		const state = SystemState.S6_EXPIRED;
		return {
			systemState: state,
			italianLabel: SystemStateLabels[state],
			hasActiveMembership: false,
			membershipNumber: membership.membershipNumber,
			previousMembershipNumber: membership.previousMembershipNumber,
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

	const state = SystemState.S0_NO_MEMBERSHIP;
	return {
		systemState: state,
		italianLabel: SystemStateLabels[state],
		hasActiveMembership: false,
		membershipNumber: membership.membershipNumber || null,
		previousMembershipNumber: membership.previousMembershipNumber,
		startDate: membership.startDate,
		endDate: membership.endDate,
		profileComplete,
		canPurchase: false, // Do NOT allow purchase in unknown state
		message: 'Status unknown. Please contact support.'
	};
}

/**
 * Result of the expired memberships update job
 */
export interface ExpiredMembershipsResult {
	processed: number;
	memberships: { id: string; userId: string; previousNumber: string }[];
}

/**
 * Update expired memberships
 * Should be run daily via cron job
 *
 * For each expired membership:
 * 1. Move membershipNumber → previousMembershipNumber
 * 2. Clear membershipNumber
 * 3. Clear startDate/endDate
 * 4. Set status = EXPIRED
 */
export async function updateExpiredMemberships(): Promise<ExpiredMembershipsResult> {
	const now = new Date();

	// Find all active memberships that have expired
	const expiredMemberships = await prisma.membership.findMany({
		where: {
			status: MembershipStatus.ACTIVE,
			endDate: {
				lt: now
			}
		},
		select: {
			id: true,
			userId: true,
			membershipNumber: true
		}
	});

	if (expiredMemberships.length === 0) {
		return { processed: 0, memberships: [] };
	}

	const processedMemberships: { id: string; userId: string; previousNumber: string }[] = [];

	// Process each membership in a transaction
	await prisma.$transaction(async (tx) => {
		for (const membership of expiredMemberships) {
			await tx.membership.update({
				where: { id: membership.id },
				data: {
					previousMembershipNumber: membership.membershipNumber,
					membershipNumber: null,
					startDate: null,
					endDate: null,
					status: MembershipStatus.EXPIRED
				}
			});

			if (membership.membershipNumber) {
				processedMemberships.push({
					id: membership.id,
					userId: membership.userId,
					previousNumber: membership.membershipNumber
				});
			}
		}
	});

	logger.info(
		{ count: processedMemberships.length },
		'Processed expired memberships'
	);

	return {
		processed: processedMemberships.length,
		memberships: processedMemberships
	};
}

/**
 * Result of canceling a membership
 */
export interface CancelMembershipResult {
	success: boolean;
	previousNumber: string | null;
}

/**
 * Cancel a membership (admin action)
 *
 * This function:
 * 1. Moves membershipNumber → previousMembershipNumber
 * 2. Clears membershipNumber
 * 3. Clears startDate/endDate
 * 4. Sets status = CANCELED
 * 5. Records the admin who performed the action
 */
export async function cancelMembership(
	membershipId: string,
	adminId: string
): Promise<CancelMembershipResult> {
	const membership = await prisma.membership.findUnique({
		where: { id: membershipId },
		select: {
			id: true,
			membershipNumber: true,
			status: true
		}
	});

	if (!membership) {
		throw new Error('Membership not found');
	}

	// Don't allow canceling already canceled memberships
	if (membership.status === MembershipStatus.CANCELED) {
		throw new Error('Membership is already canceled');
	}

	const previousNumber = membership.membershipNumber;

	await prisma.membership.update({
		where: { id: membershipId },
		data: {
			previousMembershipNumber: previousNumber,
			membershipNumber: null,
			startDate: null,
			endDate: null,
			status: MembershipStatus.CANCELED,
			updatedBy: adminId
		}
	});

	logger.info(
		{ membershipId, adminId, previousNumber },
		'Membership canceled by admin'
	);

	return {
		success: true,
		previousNumber
	};
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
		// Expired memberships with successful payments should NOT block new membership creation
		const existingMembership = await tx.membership.findFirst({
			where: {
				userId,
				OR: [
					// Currently active membership
					{ status: MembershipStatus.ACTIVE },
					// Payment in progress (not expired)
					{
						status: { not: MembershipStatus.EXPIRED },
						paymentStatus: PaymentStatus.PENDING
					},
					// Payment succeeded but not yet activated (awaiting number assignment)
					{
						status: MembershipStatus.PENDING,
						paymentStatus: PaymentStatus.SUCCEEDED
					}
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
	profile?: { firstName: string | null } | null;
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
			profile: {
				select: { firstName: true }
			},
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

/** Result for a single assigned user */
interface AssignedUser {
	userId: string;
	email: string;
	membershipNumber: string;
	firstName: string;
	endDate: Date;
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
	assigned: AssignedUser[];
	usersWithoutCard: { userId: string; email: string }[];
	numberIndex: number;
}> {
	const assigned: AssignedUser[] = [];
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

		assigned.push({
			userId: user.id,
			email: user.email,
			membershipNumber,
			firstName: user.profile?.firstName || 'Socio',
			endDate
		});
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
	const start = parseInt(startNumber, 10);
	const end = parseInt(endNumber, 10);

	const result = await prisma.$transaction(async (tx) => {
		// Verify ALL numbers in the range are within configured card ranges
		const validation = await validateRangeAgainstConfigured(tx, start, end);
		if (!validation.valid) {
			const sample = validation.invalidNumbers.slice(0, 5);
			const more =
				validation.invalidNumbers.length > 5
					? ` e altri ${validation.invalidNumbers.length - 5}`
					: '';
			throw new Error(
				`I seguenti numeri non sono in nessun range configurato: ${sample.join(', ')}${more}. ` +
					`Configura prima i range appropriati.`
			);
		}

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

	return result;
}

/**
 * Result of single membership number assignment
 */
export interface SingleAssignResult {
	success: boolean;
	email: string;
	membershipNumber: string;
}

/**
 * Assign a single specific membership number to a user
 * Uses transaction to ensure atomicity and prevent duplicate assignments
 * @param userId - User ID to assign the number to
 * @param membershipNumber - Specific membership number to assign
 * @returns SingleAssignResult with success status and assigned details
 */
export async function assignSingleMembershipNumber(
	userId: string,
	membershipNumber: string
): Promise<SingleAssignResult> {
	const result = await prisma.$transaction(async (tx) => {
		// 1. Check if number is already assigned
		const existing = await tx.membership.findFirst({
			where: { membershipNumber }
		});

		if (existing) {
			throw new Error(`Il numero ${membershipNumber} è già assegnato`);
		}

		// 2. Verify the number is within a configured range
		const isInRange = await isNumberInConfiguredRangesWithTx(tx, membershipNumber);
		if (!isInRange) {
			throw new Error(
				`Il numero ${membershipNumber} non è presente in nessun range configurato. ` +
					`Configura prima un range che includa questo numero.`
			);
		}

		// 3. Find user with S4 membership (payment succeeded, no number)
		const user = await tx.user.findUnique({
			where: { id: userId },
			include: {
				profile: {
					select: { firstName: true }
				},
				memberships: {
					where: {
						paymentStatus: PaymentStatus.SUCCEEDED,
						membershipNumber: null,
						status: {
							notIn: [MembershipStatus.EXPIRED, MembershipStatus.CANCELED]
						}
					},
					orderBy: { createdAt: 'desc' },
					take: 1
				}
			}
		});

		if (!user) {
			throw new Error('Utente non trovato');
		}

		const membership = user.memberships[0];
		if (!membership) {
			throw new Error('Utente non in stato S4 (pagamento completato, in attesa di tessera)');
		}

		// 4. Assign the number
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

		logger.info(
			{ userId, email: user.email, membershipNumber },
			'Single membership number assigned'
		);

		return {
			success: true,
			email: user.email,
			membershipNumber
		};
	});

	return result;
}

/**
 * Get users awaiting card assignment (S4 state)
 * These are users with payment succeeded but no membership number assigned
 * Excludes expired and canceled memberships
 */
export async function getUsersAwaitingCard() {
	try {
		return await prisma.user.findMany({
			where: {
				memberships: {
					some: {
						paymentStatus: PaymentStatus.SUCCEEDED,
						membershipNumber: null,
						status: {
							notIn: [MembershipStatus.EXPIRED, MembershipStatus.CANCELED]
						}
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
						membershipNumber: null,
						status: {
							notIn: [MembershipStatus.EXPIRED, MembershipStatus.CANCELED]
						}
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
	assigned: { userId: string; email: string; membershipNumber: string; firstName: string; endDate: Date }[];
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
	const result = await prisma.$transaction(async (tx) => {
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

	return result;
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
