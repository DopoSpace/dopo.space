/**
 * Card Number Range Service
 *
 * Business logic for managing membership card number ranges.
 * Handles range creation, conflict detection, and available number calculation.
 */

import { prisma } from '../db/prisma';
import type { CardNumberRange } from '@prisma/client';

/**
 * Result of adding a new card number range
 */
export interface AddRangeResult {
	success: boolean;
	range?: CardNumberRange;
	conflicts?: string[];
	error?: string;
}

/**
 * Range with calculated statistics
 */
export interface CardNumberRangeWithStats extends CardNumberRange {
	totalNumbers: number;
	usedNumbers: number;
	availableNumbers: number;
}

/**
 * Generate all membership numbers for a range
 */
export function generateNumbersFromRange(
	startNumber: number,
	endNumber: number
): string[] {
	const numbers: string[] = [];
	for (let i = startNumber; i <= endNumber; i++) {
		numbers.push(i.toString());
	}
	return numbers;
}

/**
 * Check for conflicts before adding a new range
 * Checks against both existing ranges and already assigned membership numbers
 */
export async function checkRangeConflicts(
	startNumber: number,
	endNumber: number
): Promise<{ hasConflicts: boolean; conflictingNumbers: string[] }> {
	// Generate all potential numbers from the new range
	const newNumbers = generateNumbersFromRange(startNumber, endNumber);

	// Find which numbers already exist in memberships
	const existingMemberships = await prisma.membership.findMany({
		where: {
			membershipNumber: {
				in: newNumbers
			}
		},
		select: {
			membershipNumber: true
		}
	});

	const conflictingNumbers = existingMemberships
		.map((m) => m.membershipNumber)
		.filter((n): n is string => n !== null);

	return {
		hasConflicts: conflictingNumbers.length > 0,
		conflictingNumbers
	};
}

/**
 * Add a new card number range
 */
export async function addCardNumberRange(
	startNumber: number,
	endNumber: number,
	associationYearId: string,
	adminId?: string
): Promise<AddRangeResult> {
	// Validate range
	if (startNumber > endNumber) {
		return {
			success: false,
			error: 'Il numero iniziale deve essere minore o uguale al numero finale'
		};
	}

	if (endNumber - startNumber + 1 > 1000) {
		return {
			success: false,
			error: 'Il range non può contenere più di 1000 numeri'
		};
	}

	// Check for conflicts with existing assigned numbers
	const { hasConflicts, conflictingNumbers } = await checkRangeConflicts(
		startNumber,
		endNumber
	);

	if (hasConflicts) {
		return {
			success: false,
			conflicts: conflictingNumbers,
			error: `I seguenti numeri sono già assegnati: ${conflictingNumbers.slice(0, 10).join(', ')}${conflictingNumbers.length > 10 ? ` e altri ${conflictingNumbers.length - 10}` : ''}`
		};
	}

	// Check for overlapping ranges in the same year
	const overlappingRanges = await prisma.cardNumberRange.findMany({
		where: {
			associationYearId,
			OR: [
				// New range starts within existing range
				{
					startNumber: { lte: startNumber },
					endNumber: { gte: startNumber }
				},
				// New range ends within existing range
				{
					startNumber: { lte: endNumber },
					endNumber: { gte: endNumber }
				},
				// New range completely contains existing range
				{
					startNumber: { gte: startNumber },
					endNumber: { lte: endNumber }
				}
			]
		}
	});

	if (overlappingRanges.length > 0) {
		const overlaps = overlappingRanges.map((r) => `${r.startNumber}-${r.endNumber}`);
		return {
			success: false,
			error: `Il range si sovrappone con range esistenti: ${overlaps.join(', ')}`
		};
	}

	// Create the range
	const range = await prisma.cardNumberRange.create({
		data: {
			startNumber,
			endNumber,
			associationYearId,
			createdBy: adminId
		}
	});

	return {
		success: true,
		range
	};
}

/**
 * Get all card number ranges for a year with statistics
 */
export async function getCardNumberRangesWithStats(
	associationYearId: string
): Promise<CardNumberRangeWithStats[]> {
	const ranges = await prisma.cardNumberRange.findMany({
		where: { associationYearId },
		orderBy: { startNumber: 'asc' }
	});

	// Get all assigned membership numbers
	const assignedNumbers = await prisma.membership.findMany({
		where: {
			membershipNumber: { not: null }
		},
		select: {
			membershipNumber: true
		}
	});

	const assignedSet = new Set(assignedNumbers.map((m) => m.membershipNumber));

	// Calculate stats for each range
	return ranges.map((range) => {
		const totalNumbers = range.endNumber - range.startNumber + 1;
		const rangeNumbers = generateNumbersFromRange(range.startNumber, range.endNumber);
		const usedNumbers = rangeNumbers.filter((n) => assignedSet.has(n)).length;

		return {
			...range,
			totalNumbers,
			usedNumbers,
			availableNumbers: totalNumbers - usedNumbers
		};
	});
}

/**
 * Get all available (unassigned) membership numbers from all ranges for a year
 */
export async function getAvailableNumbers(associationYearId: string): Promise<string[]> {
	// Get all ranges for this year
	const ranges = await prisma.cardNumberRange.findMany({
		where: { associationYearId },
		orderBy: { startNumber: 'asc' }
	});

	if (ranges.length === 0) {
		return [];
	}

	// Generate all possible numbers from all ranges
	const allPossibleNumbers: string[] = [];
	for (const range of ranges) {
		const numbers = generateNumbersFromRange(range.startNumber, range.endNumber);
		allPossibleNumbers.push(...numbers);
	}

	// Get all already assigned membership numbers (from ANY year - numbers are globally unique)
	const assignedNumbers = await prisma.membership.findMany({
		where: {
			membershipNumber: { not: null }
		},
		select: {
			membershipNumber: true
		}
	});

	const assignedSet = new Set(assignedNumbers.map((m) => m.membershipNumber));

	// Return only available numbers
	return allPossibleNumbers.filter((n) => !assignedSet.has(n));
}

/**
 * Get count of available numbers for a year
 */
export async function getAvailableNumbersCount(associationYearId: string): Promise<number> {
	const available = await getAvailableNumbers(associationYearId);
	return available.length;
}

/**
 * Delete a card number range (only if no numbers from it have been used)
 */
export async function deleteCardNumberRange(
	rangeId: string
): Promise<{ success: boolean; error?: string }> {
	const range = await prisma.cardNumberRange.findUnique({
		where: { id: rangeId }
	});

	if (!range) {
		return { success: false, error: 'Range non trovato' };
	}

	// Check if any numbers from this range have been assigned
	const rangeNumbers = generateNumbersFromRange(range.startNumber, range.endNumber);

	const usedNumbers = await prisma.membership.findMany({
		where: {
			membershipNumber: { in: rangeNumbers }
		},
		select: { membershipNumber: true }
	});

	if (usedNumbers.length > 0) {
		return {
			success: false,
			error: `Impossibile eliminare: ${usedNumbers.length} numeri di questo range sono già stati assegnati`
		};
	}

	// Safe to delete
	await prisma.cardNumberRange.delete({
		where: { id: rangeId }
	});

	return { success: true };
}

/**
 * Get all assigned membership numbers with user info (for display in admin)
 */
export async function getAssignedNumbers(associationYearId?: string) {
	const where = associationYearId
		? {
				membershipNumber: { not: null },
				associationYearId
			}
		: {
				membershipNumber: { not: null }
			};

	return await prisma.membership.findMany({
		where,
		include: {
			user: {
				select: {
					email: true,
					profile: {
						select: {
							firstName: true,
							lastName: true
						}
					}
				}
			}
		},
		orderBy: { membershipNumber: 'asc' }
	});
}
