/**
 * Italian Tax Code (Codice Fiscale) Utilities
 *
 * Provides validation, data extraction, and generation of Italian tax codes.
 * Supports omocodia (duplicate CF handling with letter substitutions).
 *
 * References:
 * - https://it.wikipedia.org/wiki/Codice_fiscale
 * - Decreto Ministeriale 12/03/1974
 */

import { findCadastralCodeByCity } from '$lib/server/data/cadastral-codes';

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
 * Fix the checksum character of a tax code
 * Takes the first 15 characters and calculates the correct 16th character
 *
 * @param cf - The tax code with potentially invalid checksum
 * @returns The corrected tax code, or null if format is invalid
 */
export function fixTaxCodeChecksum(cf: string): string | null {
	if (!cf || typeof cf !== 'string') {
		return null;
	}

	const upper = cf.toUpperCase().trim();

	// Must be 16 characters with valid format (except possibly wrong checksum)
	if (upper.length !== 16) {
		return null;
	}

	// Check that first 15 chars have valid format
	const omocodiaDigit = '[0-9LMNPQRSTUV]';
	const regex = new RegExp(
		`^[A-Z]{6}${omocodiaDigit}{2}[A-Z]${omocodiaDigit}{2}[A-Z]${omocodiaDigit}{3}$`
	);
	const first15 = upper.substring(0, 15);

	if (!regex.test(first15)) {
		return null;
	}

	// Calculate correct checksum
	let sum = 0;

	for (let i = 0; i < 15; i++) {
		const char = first15.charAt(i);
		if (i % 2 === 0) {
			sum += ODD_VALUES[char] ?? 0;
		} else {
			sum += EVEN_VALUES[char] ?? 0;
		}
	}

	const correctChecksum = CHECKSUM_LETTERS.charAt(sum % 26);

	return first15 + correctChecksum;
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

	// Compare with provided birth date (use UTC methods since form dates are parsed as UTC midnight)
	const providedDay = birthDate.getUTCDate();
	const providedMonth = birthDate.getUTCMonth() + 1; // JS months are 0-indexed
	const providedYear = birthDate.getUTCFullYear();

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

// ============================================================================
// TAX CODE GENERATION
// ============================================================================

/**
 * Reverse month codes: number → letter
 */
const MONTH_LETTERS: Record<number, string> = {
	1: 'A',
	2: 'B',
	3: 'C',
	4: 'D',
	5: 'E',
	6: 'H',
	7: 'L',
	8: 'M',
	9: 'P',
	10: 'R',
	11: 'S',
	12: 'T'
};

/**
 * Extract consonants from a string
 */
function extractConsonants(str: string): string {
	return str.toUpperCase().replace(/[^BCDFGHJKLMNPQRSTVWXYZ]/g, '');
}

/**
 * Extract vowels from a string
 */
function extractVowels(str: string): string {
	return str.toUpperCase().replace(/[^AEIOU]/g, '');
}

/**
 * Generate the 3-character code for surname
 * Rule: consonants first, then vowels, pad with X if needed
 */
export function generateSurnameCode(surname: string): string {
	const consonants = extractConsonants(surname);
	const vowels = extractVowels(surname);
	const combined = consonants + vowels + 'XXX';
	return combined.substring(0, 3);
}

/**
 * Generate the 3-character code for first name
 * Rule: if 4+ consonants, use 1st, 3rd, 4th
 *       otherwise: consonants first, then vowels, pad with X
 */
export function generateNameCode(name: string): string {
	const consonants = extractConsonants(name);
	const vowels = extractVowels(name);

	if (consonants.length >= 4) {
		// Use 1st, 3rd, 4th consonants
		return consonants[0] + consonants[2] + consonants[3];
	}

	// Otherwise same rule as surname
	const combined = consonants + vowels + 'XXX';
	return combined.substring(0, 3);
}

/**
 * Calculate the checksum character for a tax code
 */
function calculateChecksum(first15: string): string {
	let sum = 0;

	for (let i = 0; i < 15; i++) {
		const char = first15.charAt(i);
		if (i % 2 === 0) {
			// Odd position (1-indexed)
			sum += ODD_VALUES[char] ?? 0;
		} else {
			// Even position (1-indexed)
			sum += EVEN_VALUES[char] ?? 0;
		}
	}

	return CHECKSUM_LETTERS.charAt(sum % 26);
}

/**
 * Input data required to generate a tax code
 */
export interface TaxCodeGenerationInput {
	/** First name */
	firstName: string;
	/** Last name (surname) */
	lastName: string;
	/** Birth date */
	birthDate: Date;
	/** Gender: 'M' for male, 'F' for female */
	gender: 'M' | 'F';
	/** Birth city/municipality name */
	birthCity: string;
	/** Birth province (2 letters, or 'EE' for foreign) */
	birthProvince: string;
}

/**
 * Result of tax code generation
 */
export interface TaxCodeGenerationResult {
	/** Whether generation was successful */
	success: boolean;
	/** The generated tax code (if successful) */
	taxCode?: string;
	/** Error message (if failed) */
	error?: string;
}

/**
 * Generate an Italian tax code (Codice Fiscale) from personal data
 *
 * Note: This generates the "base" tax code. In case of duplicates (omocodia),
 * the official tax code may have some digits replaced with letters.
 * This function does NOT handle omocodia generation.
 *
 * @param input - Personal data required for generation
 * @returns Generation result with tax code or error
 */
export async function generateTaxCode(
	input: TaxCodeGenerationInput
): Promise<TaxCodeGenerationResult> {
	const { firstName, lastName, birthDate, gender, birthCity, birthProvince } = input;

	// Validate inputs
	if (!firstName || firstName.trim().length < 2) {
		return { success: false, error: 'Nome non valido' };
	}
	if (!lastName || lastName.trim().length < 2) {
		return { success: false, error: 'Cognome non valido' };
	}
	if (!birthDate || isNaN(birthDate.getTime())) {
		return { success: false, error: 'Data di nascita non valida' };
	}
	if (gender !== 'M' && gender !== 'F') {
		return { success: false, error: 'Sesso non valido (deve essere M o F)' };
	}
	if (!birthCity || birthCity.trim().length < 2) {
		return { success: false, error: 'Comune di nascita non valido' };
	}

	// Generate surname code (3 chars)
	const surnameCode = generateSurnameCode(lastName);

	// Generate name code (3 chars)
	const nameCode = generateNameCode(firstName);

	// Generate year code (2 digits) — use UTC to match storage format
	const year = birthDate.getUTCFullYear();
	const yearCode = (year % 100).toString().padStart(2, '0');

	// Generate month code (1 letter)
	const month = birthDate.getUTCMonth() + 1; // JS months are 0-indexed
	const monthCode = MONTH_LETTERS[month];
	if (!monthCode) {
		return { success: false, error: 'Mese non valido' };
	}

	// Generate day code (2 digits, +40 for females)
	let day = birthDate.getUTCDate();
	if (gender === 'F') {
		day += 40;
	}
	const dayCode = day.toString().padStart(2, '0');

	// Look up cadastral code
	const cadastralCode = await findCadastralCodeByCity(birthCity, birthProvince);
	if (!cadastralCode) {
		return {
			success: false,
			error: `Comune di nascita "${birthCity}" non trovato nel database`
		};
	}

	// Combine first 15 characters
	const first15 = surnameCode + nameCode + yearCode + monthCode + dayCode + cadastralCode;

	// Calculate checksum
	const checksum = calculateChecksum(first15);

	// Final tax code
	const taxCode = first15 + checksum;

	return { success: true, taxCode };
}

/**
 * Validate that the name/surname codes in a tax code match the provided name and surname.
 *
 * Returns null if consistent, or a warning message if the codes don't match.
 * A mismatch may indicate a compound name (e.g., "Bianca Maria" vs "Bianca")
 * or a transliteration difference for foreign names.
 *
 * @param cf - The tax code
 * @param firstName - The first name to check
 * @param lastName - The last name to check
 * @returns Warning message if mismatch, null if consistent
 */
export function validateTaxCodeNameConsistency(
	cf: string,
	firstName: string,
	lastName: string
): string | null {
	if (!cf || !validateTaxCodeFormat(cf) || !firstName || !lastName) {
		return null;
	}

	const upper = cf.toUpperCase();
	const cfSurnameCode = upper.substring(0, 3);
	const cfNameCode = upper.substring(3, 6);

	const expectedSurnameCode = generateSurnameCode(lastName);
	const expectedNameCode = generateNameCode(firstName);

	const surnameMismatch = cfSurnameCode !== expectedSurnameCode;
	const nameMismatch = cfNameCode !== expectedNameCode;

	if (!surnameMismatch && !nameMismatch) {
		return null;
	}

	if (surnameMismatch && nameMismatch) {
		return 'Il nome e il cognome non corrispondono al codice fiscale. Verifica di aver inserito il nome completo come risulta sul CF.';
	}

	if (nameMismatch) {
		return 'Il nome non corrisponde al codice fiscale. Potrebbe essere necessario inserire il nome completo (es. nome composto).';
	}

	return 'Il cognome non corrisponde al codice fiscale. Verifica di aver inserito il cognome completo come risulta sul CF.';
}

/**
 * Try to find the correct compound first name that matches the CF name code.
 *
 * When a first name doesn't match the CF, it's often because the person has a
 * compound name (e.g., "Bianca Maria" registered as "Bianca"). This function
 * tries common Italian names as a second name to find a match.
 *
 * @param cf - The tax code
 * @param firstName - The first name currently on record
 * @param namesDatabase - Map of names to gender (from italian-names.ts)
 * @returns The suggested compound name if found, null otherwise
 */
export function suggestCompoundName(
	cf: string,
	firstName: string,
	namesDatabase: Record<string, 'M' | 'F'>
): string | null {
	if (!cf || !validateTaxCodeFormat(cf) || !firstName) {
		return null;
	}

	const upper = cf.toUpperCase();
	const cfNameCode = upper.substring(3, 6);
	const currentNameCode = generateNameCode(firstName);

	// Already matches — no fix needed
	if (cfNameCode === currentNameCode) {
		return null;
	}

	// Determine gender from CF to filter candidate names
	const gender = extractGenderFromTaxCode(cf);

	// Try "firstName + candidateName" combinations
	for (const [candidateName, candidateGender] of Object.entries(namesDatabase)) {
		// Only try names matching the CF gender
		if (gender && candidateGender !== gender) continue;

		// Skip if candidate is the same as the first name
		if (candidateName.toUpperCase() === firstName.toUpperCase()) continue;

		const compound = `${firstName} ${candidateName}`;
		if (generateNameCode(compound) === cfNameCode) {
			// Format nicely: "Bianca Maria"
			const formatted = firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase() +
				' ' + candidateName.charAt(0).toUpperCase() + candidateName.slice(1).toLowerCase();
			return formatted;
		}
	}

	return null;
}
