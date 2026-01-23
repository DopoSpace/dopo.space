/**
 * Card Number Range Service
 *
 * Business logic for managing membership card number ranges.
 * Handles range creation, conflict detection, and available number calculation.
 */

import { prisma } from '../db/prisma';
import type { CardNumberRange, Prisma } from '@prisma/client';
import pino from 'pino';

const logger = pino({ name: 'card-ranges' });

// Type for transaction client
type TransactionClient = Omit<typeof prisma, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>;

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
 * Represents a contiguous sub-range of available numbers
 */
export interface AvailableSubRange {
	start: number;
	end: number;
}

/**
 * Range with calculated statistics
 */
export interface CardNumberRangeWithStats extends CardNumberRange {
	totalNumbers: number;
	usedNumbers: number;
	availableNumbers: number;
	/** Contiguous sub-ranges of available (unassigned) numbers */
	availableSubRanges: AvailableSubRange[];
}

/**
 * Group a sorted array of numbers into contiguous sub-ranges
 * Example: [1,2,3,5,6,10] => [{start:1,end:3}, {start:5,end:6}, {start:10,end:10}]
 */
function groupIntoContiguousRanges(numbers: number[]): AvailableSubRange[] {
	if (numbers.length === 0) return [];

	const ranges: AvailableSubRange[] = [];
	let start = numbers[0];
	let end = numbers[0];

	for (let i = 1; i < numbers.length; i++) {
		if (numbers[i] === end + 1) {
			// Contiguous, extend the current range
			end = numbers[i];
		} else {
			// Gap found, save current range and start new one
			ranges.push({ start, end });
			start = numbers[i];
			end = numbers[i];
		}
	}

	// Don't forget the last range
	ranges.push({ start, end });

	return ranges;
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
 * Add a new card number range (global pool)
 */
export async function addCardNumberRange(
	startNumber: number,
	endNumber: number,
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

	// Check for overlapping ranges (global check)
	const overlappingRanges = await prisma.cardNumberRange.findMany({
		where: {
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
			createdBy: adminId
		}
	});

	return {
		success: true,
		range
	};
}

/**
 * Get all card number ranges with statistics (global pool)
 */
export async function getCardNumberRangesWithStats(): Promise<CardNumberRangeWithStats[]> {
	const ranges = await prisma.cardNumberRange.findMany({
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

		// Calculate available numbers and group into contiguous sub-ranges
		const availableNumbersList = rangeNumbers
			.filter((n) => !assignedSet.has(n))
			.map((n) => parseInt(n, 10))
			.sort((a, b) => a - b);
		const availableSubRanges = groupIntoContiguousRanges(availableNumbersList);

		return {
			...range,
			totalNumbers,
			usedNumbers,
			availableNumbers: totalNumbers - usedNumbers,
			availableSubRanges
		};
	});
}

/**
 * Core implementation for getting available membership numbers
 * @param client - Prisma client or transaction client
 */
async function getAvailableNumbersImpl(client: TransactionClient): Promise<string[]> {
	const ranges = await client.cardNumberRange.findMany({
		orderBy: { startNumber: 'asc' }
	});

	if (ranges.length === 0) {
		return [];
	}

	const allPossibleNumbers: string[] = [];
	for (const range of ranges) {
		allPossibleNumbers.push(...generateNumbersFromRange(range.startNumber, range.endNumber));
	}

	const assignedNumbers = await client.membership.findMany({
		where: { membershipNumber: { not: null } },
		select: { membershipNumber: true }
	});

	const assignedSet = new Set(assignedNumbers.map((m) => m.membershipNumber));

	return allPossibleNumbers.filter((n) => !assignedSet.has(n));
}

/**
 * Get all available (unassigned) membership numbers from global pool
 */
export async function getAvailableNumbers(): Promise<string[]> {
	return getAvailableNumbersImpl(prisma);
}

/**
 * Get all available (unassigned) membership numbers from global pool
 * Transaction-safe version that uses provided client
 * @param tx - Transaction client
 */
export async function getAvailableNumbersWithTx(tx: TransactionClient): Promise<string[]> {
	return getAvailableNumbersImpl(tx);
}

/**
 * Check if a number falls within any configured card range
 * Transaction-safe version that uses provided client
 * @param tx - Transaction client
 * @param membershipNumber - The number to check (can be string with prefix or plain number)
 */
export async function isNumberInConfiguredRangesWithTx(
	tx: TransactionClient,
	membershipNumber: string | number
): Promise<boolean> {
	// Extract numeric part from the membership number (handles prefixes like "DOPO-123")
	const numStr = typeof membershipNumber === 'string' ? membershipNumber : membershipNumber.toString();
	const numericMatch = numStr.match(/\d+/);
	if (!numericMatch) return false;

	const num = parseInt(numericMatch[0], 10);
	if (isNaN(num)) return false;

	const range = await tx.cardNumberRange.findFirst({
		where: {
			startNumber: { lte: num },
			endNumber: { gte: num }
		}
	});

	return range !== null;
}

/**
 * Check if ALL numbers in a range are within configured card ranges
 * Returns validation result with list of invalid numbers
 * @param tx - Transaction client
 * @param startNumber - Start of range to validate
 * @param endNumber - End of range to validate
 */
export async function validateRangeAgainstConfigured(
	tx: TransactionClient,
	startNumber: number,
	endNumber: number
): Promise<{ valid: boolean; invalidNumbers: number[] }> {
	const ranges = await tx.cardNumberRange.findMany({
		orderBy: { startNumber: 'asc' }
	});

	if (ranges.length === 0) {
		// No ranges configured - all numbers are invalid
		const invalidNumbers: number[] = [];
		for (let num = startNumber; num <= endNumber; num++) {
			invalidNumbers.push(num);
		}
		return { valid: false, invalidNumbers };
	}

	const invalidNumbers: number[] = [];

	for (let num = startNumber; num <= endNumber; num++) {
		const isInRange = ranges.some((r) => num >= r.startNumber && num <= r.endNumber);
		if (!isInRange) {
			invalidNumbers.push(num);
		}
	}

	return {
		valid: invalidNumbers.length === 0,
		invalidNumbers
	};
}

/**
 * Get count of available numbers from global pool
 * Optimized version that calculates count without materializing full array
 */
export async function getAvailableNumbersCount(): Promise<number> {
	// Get all ranges
	const ranges = await prisma.cardNumberRange.findMany();

	if (ranges.length === 0) {
		return 0;
	}

	// Calculate total possible numbers
	const totalPossible = ranges.reduce(
		(sum, range) => sum + (range.endNumber - range.startNumber + 1),
		0
	);

	// Generate all possible numbers (needed for the IN clause)
	const allPossibleNumbers: string[] = [];
	for (const range of ranges) {
		allPossibleNumbers.push(...generateNumbersFromRange(range.startNumber, range.endNumber));
	}

	// Count assigned numbers that fall within any range
	const assignedCount = await prisma.membership.count({
		where: {
			membershipNumber: { in: allPossibleNumbers }
		}
	});

	return totalPossible - assignedCount;
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
export async function getAssignedNumbers() {
	return await prisma.membership.findMany({
		where: {
			membershipNumber: { not: null }
		},
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
