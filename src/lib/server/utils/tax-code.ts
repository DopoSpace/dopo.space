/**
 * Italian Tax Code (Codice Fiscale) Utilities
 *
 * Provides validation and data extraction from Italian tax codes.
 * Supports omocodia (duplicate CF handling with letter substitutions).
 *
 * References:
 * - https://it.wikipedia.org/wiki/Codice_fiscale
 * - Decreto Ministeriale 12/03/1974
 */

/**
 * Omocodia substitution map: digit → letter
 * Used when CFs would be duplicates, specific positions get letters instead of numbers
 */
const OMOCODIA_MAP: Record<string, string> = {
	'0': 'L',
	'1': 'M',
	'2': 'N',
	'3': 'P',
	'4': 'Q',
	'5': 'R',
	'6': 'S',
	'7': 'T',
	'8': 'U',
	'9': 'V'
};

/**
 * Reverse omocodia map: letter → digit
 */
const OMOCODIA_REVERSE: Record<string, string> = Object.fromEntries(
	Object.entries(OMOCODIA_MAP).map(([k, v]) => [v, k])
);

/**
 * Positions in CF where omocodia substitution can occur (0-indexed)
 * These are the numeric positions: year, month day, cadastral code numbers
 */
const OMOCODIA_POSITIONS = [6, 7, 9, 10, 12, 13, 14];

/**
 * Month codes used in Italian tax code
 */
const MONTH_CODES: Record<string, number> = {
	A: 1,
	B: 2,
	C: 3,
	D: 4,
	E: 5,
	H: 6,
	L: 7,
	M: 8,
	P: 9,
	R: 10,
	S: 11,
	T: 12
};

/**
 * Checksum character values for odd positions (1, 3, 5, ... - 1-indexed)
 */
const ODD_VALUES: Record<string, number> = {
	'0': 1,
	'1': 0,
	'2': 5,
	'3': 7,
	'4': 9,
	'5': 13,
	'6': 15,
	'7': 17,
	'8': 19,
	'9': 21,
	A: 1,
	B: 0,
	C: 5,
	D: 7,
	E: 9,
	F: 13,
	G: 15,
	H: 17,
	I: 19,
	J: 21,
	K: 2,
	L: 4,
	M: 18,
	N: 20,
	O: 11,
	P: 3,
	Q: 6,
	R: 8,
	S: 12,
	T: 14,
	U: 16,
	V: 10,
	W: 22,
	X: 25,
	Y: 24,
	Z: 23
};

/**
 * Checksum character values for even positions (2, 4, 6, ... - 1-indexed)
 */
const EVEN_VALUES: Record<string, number> = {
	'0': 0,
	'1': 1,
	'2': 2,
	'3': 3,
	'4': 4,
	'5': 5,
	'6': 6,
	'7': 7,
	'8': 8,
	'9': 9,
	A: 0,
	B: 1,
	C: 2,
	D: 3,
	E: 4,
	F: 5,
	G: 6,
	H: 7,
	I: 8,
	J: 9,
	K: 10,
	L: 11,
	M: 12,
	N: 13,
	O: 14,
	P: 15,
	Q: 16,
	R: 17,
	S: 18,
	T: 19,
	U: 20,
	V: 21,
	W: 22,
	X: 23,
	Y: 24,
	Z: 25
};

/**
 * Checksum result letter (0-25 → A-Z)
 */
const CHECKSUM_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/**
 * Normalize a tax code by converting omocodia letters back to digits
 * This allows validation of CFs with omocodia substitutions
 *
 * @param cf - The tax code (may contain omocodia letters)
 * @returns Normalized tax code with digits instead of omocodia letters
 *
 * @example
 * normalizeOmocodia('RSSMRA85M10H501R') // Returns 'RSSMRA85M10H501R' (no change)
 * normalizeOmocodia('RSSMRA85M1LH5L1R') // Returns 'RSSMRA85M10H501R' (L→0)
 */
export function normalizeOmocodia(cf: string): string {
	if (!cf || cf.length !== 16) {
		return cf;
	}

	const upper = cf.toUpperCase();
	const chars = upper.split('');

	// Replace omocodia letters with digits at specific positions
	for (const pos of OMOCODIA_POSITIONS) {
		const char = chars[pos];
		if (OMOCODIA_REVERSE[char] !== undefined) {
			chars[pos] = OMOCODIA_REVERSE[char];
		}
	}

	return chars.join('');
}

/**
 * Validate tax code format using regex
 * Supports both standard format and omocodia variations
 *
 * Standard format: AAAAAA00A00A000A
 * - 6 letters (surname + name)
 * - 2 digits (year)
 * - 1 letter (month)
 * - 2 digits (day, +40 for females)
 * - 1 letter + 3 digits (cadastral code)
 * - 1 letter (checksum)
 *
 * @param cf - The tax code to validate
 * @returns true if format is valid
 */
export function validateTaxCodeFormat(cf: string): boolean {
	if (!cf || typeof cf !== 'string') {
		return false;
	}

	const upper = cf.toUpperCase().trim();

	if (upper.length !== 16) {
		return false;
	}

	// Standard format regex (with omocodia support)
	// Positions 6,7,9,10,12,13,14 can be digits OR omocodia letters (LMNPQRSTUV)
	const omocodiaDigit = '[0-9LMNPQRSTUV]';
	const regex = new RegExp(
		`^[A-Z]{6}${omocodiaDigit}{2}[A-Z]${omocodiaDigit}{2}[A-Z]${omocodiaDigit}{3}[A-Z]$`
	);

	return regex.test(upper);
}

/**
 * Validate tax code checksum (control character)
 * Uses the official algorithm from DM 12/03/1974
 *
 * @param cf - The tax code to validate
 * @returns true if checksum is valid
 */
export function validateTaxCodeChecksum(cf: string): boolean {
	if (!validateTaxCodeFormat(cf)) {
		return false;
	}

	const upper = cf.toUpperCase();
	// Don't normalize - checksum is calculated on original CF including omocodia letters
	const first15 = upper.substring(0, 15);
	const providedChecksum = upper.charAt(15);

	let sum = 0;

	for (let i = 0; i < 15; i++) {
		const char = first15.charAt(i);
		// 1-indexed: odd positions are 1, 3, 5, ... (i = 0, 2, 4, ...)
		// even positions are 2, 4, 6, ... (i = 1, 3, 5, ...)
		if (i % 2 === 0) {
			// Odd position (1-indexed)
			sum += ODD_VALUES[char] ?? 0;
		} else {
			// Even position (1-indexed)
			sum += EVEN_VALUES[char] ?? 0;
		}
	}

	const expectedChecksum = CHECKSUM_LETTERS.charAt(sum % 26);

	return providedChecksum === expectedChecksum;
}

/**
 * Extract gender from tax code
 * Day of birth > 40 indicates female (40 is added to the day)
 *
 * @param cf - The tax code
 * @returns 'M' for male, 'F' for female, or null if invalid
 */
export function extractGenderFromTaxCode(cf: string): 'M' | 'F' | null {
	if (!validateTaxCodeFormat(cf)) {
		return null;
	}

	const normalized = normalizeOmocodia(cf.toUpperCase());
	const dayStr = normalized.substring(9, 11);
	const day = parseInt(dayStr, 10);

	if (isNaN(day)) {
		return null;
	}

	// Day > 40 means female (40 is added to birth day)
	return day > 40 ? 'F' : 'M';
}

/**
 * Extract birth date components from tax code
 *
 * Note: Year is only 2 digits, so we need to infer the century.
 * The algorithm uses a sliding window based on current year:
 * - If year <= currentYear%100 + 10: assume current century (2000s)
 * - Otherwise: assume previous century (1900s)
 *
 * KNOWN LIMITATION: This heuristic may incorrectly infer the century for:
 * - Users born more than ~90 years ago (e.g., in 2026, someone born in 1930
 *   has year code "30" which would be interpreted as 2030)
 * - This is acceptable for a membership system where users >90 years old
 *   are rare, but should be documented for support staff
 *
 * If accurate dates for very old users are needed, consider:
 * 1. Adding a "birth century" field for manual override
 * 2. Validating against the provided birthDate field (already done in validation)
 *
 * @param cf - The tax code
 * @returns Object with day, month, year or null if invalid
 */
export function extractBirthDateFromTaxCode(
	cf: string
): { day: number; month: number; year: number } | null {
	if (!validateTaxCodeFormat(cf)) {
		return null;
	}

	const normalized = normalizeOmocodia(cf.toUpperCase());

	// Year: positions 6-7 (0-indexed)
	const yearStr = normalized.substring(6, 8);
	let year = parseInt(yearStr, 10);

	if (isNaN(year)) {
		return null;
	}

	// Infer century using sliding window algorithm
	// See KNOWN LIMITATION in function docstring above
	const currentYear = new Date().getFullYear();
	const currentCentury = Math.floor(currentYear / 100) * 100;
	const twoDigitCurrentYear = currentYear % 100;

	if (year <= twoDigitCurrentYear + 10) {
		// Born in current century (allows for some future dates due to data entry)
		year = currentCentury + year;
	} else {
		// Born in previous century
		year = currentCentury - 100 + year;
	}

	// Month: position 8 (0-indexed)
	const monthCode = normalized.charAt(8);
	const month = MONTH_CODES[monthCode];

	if (!month) {
		return null;
	}

	// Day: positions 9-10 (0-indexed)
	const dayStr = normalized.substring(9, 11);
	let day = parseInt(dayStr, 10);

	if (isNaN(day)) {
		return null;
	}

	// Remove female offset if present
	if (day > 40) {
		day -= 40;
	}

	return { day, month, year };
}

/**
 * Validate that tax code is consistent with provided birth date
 * Checks that the birth date encoded in the CF matches the provided date
 *
 * @param cf - The tax code
 * @param birthDate - The birth date to validate against
 * @returns true if consistent, false otherwise
 */
export function validateTaxCodeConsistency(cf: string, birthDate: Date): boolean {
	const extracted = extractBirthDateFromTaxCode(cf);

	if (!extracted) {
		return false;
	}

	const { day, month, year } = extracted;

	// Compare with provided birth date
	const providedDay = birthDate.getDate();
	const providedMonth = birthDate.getMonth() + 1; // JS months are 0-indexed
	const providedYear = birthDate.getFullYear();

	return day === providedDay && month === providedMonth && year === providedYear;
}

/**
 * Comprehensive tax code validation
 * Validates format, checksum, and optionally consistency with birth date
 *
 * @param cf - The tax code
 * @param birthDate - Optional birth date for consistency check
 * @returns Object with validation result and error message if invalid
 */
export function validateTaxCode(
	cf: string,
	birthDate?: Date
): { valid: boolean; error?: string } {
	if (!cf || typeof cf !== 'string') {
		return { valid: false, error: 'Codice fiscale non fornito' };
	}

	const trimmed = cf.trim().toUpperCase();

	// validateTaxCodeChecksum already checks format, so we can skip validateTaxCodeFormat
	if (!validateTaxCodeChecksum(trimmed)) {
		// Provide more specific error message based on failure point
		if (trimmed.length !== 16) {
			return { valid: false, error: 'Il codice fiscale deve essere di 16 caratteri' };
		}
		if (!validateTaxCodeFormat(trimmed)) {
			return { valid: false, error: 'Formato codice fiscale non valido' };
		}
		return { valid: false, error: 'Carattere di controllo non valido' };
	}

	if (birthDate && !validateTaxCodeConsistency(trimmed, birthDate)) {
		return {
			valid: false,
			error: 'La data di nascita non corrisponde al codice fiscale'
		};
	}

	return { valid: true };
}
