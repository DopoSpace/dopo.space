/**
 * Date utilities
 *
 * Shared date calculation functions used across client and server code.
 */

/**
 * Calculate age from a birth date
 * @param birthDate - Date object or ISO date string
 * @returns Age in years, or a default value if date is invalid
 */
export function calculateAge(birthDate: Date | string): number {
	const date = typeof birthDate === 'string' ? new Date(birthDate) : birthDate;

	if (isNaN(date.getTime())) {
		return 99; // Default to adult for invalid dates
	}

	const today = new Date();
	let age = today.getFullYear() - date.getFullYear();
	const monthDiff = today.getMonth() - date.getMonth();

	if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < date.getDate())) {
		age--;
	}

	return age;
}

/**
 * Check if a person is at least the minimum age based on their birth date
 * @param birthDate - Date object or ISO date string
 * @param minAge - Minimum age required (default: 16)
 * @param maxAge - Maximum age allowed (default: 120)
 * @returns true if age is within valid range
 */
export function isValidAge(birthDate: Date | string, minAge = 16, maxAge = 120): boolean {
	const age = calculateAge(birthDate);
	return age >= minAge && age <= maxAge;
}
