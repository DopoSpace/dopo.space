/**
 * Membership Service
 *
 * Business logic for membership management and state transitions.
 */

import { prisma } from '../db/prisma';
import { SystemState, type MembershipSummary } from '$lib/types/membership';
import { MembershipStatus, PaymentStatus } from '@prisma/client';
import { getAvailableNumbers } from './card-ranges';

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
 * Uses transaction to prevent race conditions
 */
export async function createMembershipForPayment(userId: string) {
	const associationYear = await getActiveAssociationYear();

	if (!associationYear) {
		throw new Error('No active association year found');
	}

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
				associationYearId: associationYear.id,
				status: MembershipStatus.PENDING,
				paymentStatus: PaymentStatus.PENDING,
				paymentAmount: associationYear.membershipFee
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
	const padding = start.length; // Mantiene padding (001 → 3 cifre)

	for (let i = startNum; i <= endNum; i++) {
		const num = i.toString().padStart(padding, '0');
		numbers.push(prefix + num);
	}

	return numbers;
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
	// Generate all potential membership numbers
	const allNumbers = generateSequentialNumbers(prefix, startNumber, endNumber);

	// Use transaction for atomic operations
	return await prisma.$transaction(async (tx) => {
		// Find which numbers already exist in the database
		const existingMemberships = await tx.membership.findMany({
			where: {
				membershipNumber: {
					in: allNumbers
				}
			},
			select: {
				membershipNumber: true
			}
		});

		const existingNumbers = new Set(existingMemberships.map((m) => m.membershipNumber));
		const skipped = allNumbers.filter((num) => existingNumbers.has(num));
		const availableNumbers = allNumbers.filter((num) => !existingNumbers.has(num));

		// Get users with their memberships (only those in S4 state - payment succeeded, no number)
		const users = await tx.user.findMany({
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
			orderBy: { createdAt: 'asc' } // FIFO order
		});

		const result: BatchAssignResult = {
			assigned: [],
			skipped,
			remaining: [],
			usersWithoutCard: []
		};

		// Assign numbers to users
		let numberIndex = 0;
		for (const user of users) {
			if (numberIndex >= availableNumbers.length) {
				// No more available numbers
				result.usersWithoutCard.push({ userId: user.id, email: user.email });
				continue;
			}

			const membership = user.memberships[0];
			if (!membership) {
				// User doesn't have a valid membership (shouldn't happen due to query filter)
				result.usersWithoutCard.push({ userId: user.id, email: user.email });
				continue;
			}

			const membershipNumber = availableNumbers[numberIndex];
			numberIndex++;

			// Update membership with number and set status to ACTIVE
			await tx.membership.update({
				where: { id: membership.id },
				data: {
					membershipNumber,
					status: MembershipStatus.ACTIVE
				}
			});

			result.assigned.push({
				userId: user.id,
				email: user.email,
				membershipNumber
			});
		}

		// Calculate remaining (unused) numbers
		result.remaining = availableNumbers.slice(numberIndex);

		return result;
	});
}

/**
 * Get users awaiting card assignment (S4 state)
 * These are users with payment succeeded but no membership number assigned
 */
export async function getUsersAwaitingCard() {
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
 * Uses transaction to ensure atomicity
 */
export async function autoAssignMembershipNumbers(userIds: string[]): Promise<AutoAssignResult> {
	// Get active year
	const activeYear = await prisma.associationYear.findFirst({
		where: { isActive: true }
	});

	if (!activeYear) {
		throw new Error('Nessun anno associativo attivo');
	}

	// Get available numbers from configured ranges (outside transaction for read)
	const availableNumbers = await getAvailableNumbers(activeYear.id);

	if (availableNumbers.length === 0) {
		throw new Error('Nessun numero disponibile. Configura i range delle tessere in /admin/card-ranges');
	}

	// Use transaction for atomic assignment
	return await prisma.$transaction(async (tx) => {
		// Get users with their memberships (only those in S4 state)
		const users = await tx.user.findMany({
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
			orderBy: { createdAt: 'asc' } // FIFO order
		});

		const result: AutoAssignResult = {
			assigned: [],
			usersWithoutCard: [],
			availableCount: availableNumbers.length,
			requestedCount: userIds.length
		};

		// Assign numbers to users
		let numberIndex = 0;
		for (const user of users) {
			if (numberIndex >= availableNumbers.length) {
				result.usersWithoutCard.push({ userId: user.id, email: user.email });
				continue;
			}

			const membership = user.memberships[0];
			if (!membership) {
				result.usersWithoutCard.push({ userId: user.id, email: user.email });
				continue;
			}

			const membershipNumber = availableNumbers[numberIndex];
			numberIndex++;

			// Update membership with number and set status to ACTIVE
			await tx.membership.update({
				where: { id: membership.id },
				data: {
					membershipNumber,
					status: MembershipStatus.ACTIVE
				}
			});

			result.assigned.push({
				userId: user.id,
				email: user.email,
				membershipNumber
			});
		}

		return result;
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
			associationYear: {
				select: {
					endDate: true
				}
			}
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
 * Create membership for new year with automatic number conservation for renewals
 */
export async function createMembershipWithRenewal(
	userId: string,
	associationYearId: string
): Promise<{ membership: unknown; isRenewal: boolean; conservedNumber: string | null }> {
	// Check if this is a renewal
	const renewalStatus = await checkUserRenewalStatus(userId);

	// If renewal, use the previous number
	const membershipNumber = renewalStatus.isRenewal ? renewalStatus.previousNumber : null;
	const status = membershipNumber ? MembershipStatus.ACTIVE : MembershipStatus.PENDING;

	const associationYear = await prisma.associationYear.findUnique({
		where: { id: associationYearId }
	});

	if (!associationYear) {
		throw new Error('Anno associativo non trovato');
	}

	const membership = await prisma.membership.create({
		data: {
			userId,
			associationYearId,
			membershipNumber,
			status,
			paymentStatus: PaymentStatus.SUCCEEDED,
			paymentAmount: associationYear.membershipFee,
			startDate: new Date(),
			endDate: associationYear.endDate
		}
	});

	return {
		membership,
		isRenewal: renewalStatus.isRenewal,
		conservedNumber: membershipNumber
	};
}
