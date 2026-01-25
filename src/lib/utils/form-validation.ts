/**
 * Client-side form validation utilities
 *
 * These validators mirror the server-side Zod schemas for real-time validation
 * on blur events. Keeps validation rules in sync with src/lib/server/utils/validation.ts
 */

import { calculateAge } from './date';
import * as m from '$lib/paraglide/messages';

export type ValidationResult = {
	valid: boolean;
	error?: string;
};

export type FieldValidator = (value: string, context?: ValidationContext) => ValidationResult;

export type ValidationContext = {
	nationality?: string;
	hasForeignTaxCode?: boolean;
	residenceCountry?: string;
	birthDate?: string;
	gender?: string;
};

/**
 * Tax code format regex (supports omocodia)
 * Standard: RSSMRA85M10H501S
 * Omocodia letters can appear at digit positions: LMNPQRSTUV
 */
const TAX_CODE_REGEX =
	/^[A-Z]{6}[0-9LMNPQRSTUV]{2}[A-Z][0-9LMNPQRSTUV]{2}[A-Z][0-9LMNPQRSTUV]{3}[A-Z]$/i;

/**
 * Omocodia character to digit mapping
 */
const omocodiaMap: Record<string, string> = {
	L: '0',
	M: '1',
	N: '2',
	P: '3',
	Q: '4',
	R: '5',
	S: '6',
	T: '7',
	U: '8',
	V: '9'
};

/**
 * Convert omocodia characters to digits
 */
function normalizeOmocodia(taxCode: string): string {
	const positions = [6, 7, 9, 10, 12, 13, 14];
	let result = taxCode.toUpperCase();

	for (const pos of positions) {
		const char = result[pos];
		if (omocodiaMap[char]) {
			result = result.slice(0, pos) + omocodiaMap[char] + result.slice(pos + 1);
		}
	}

	return result;
}

/**
 * Extract birth date from tax code
 */
function extractBirthDateFromTaxCode(taxCode: string): { year: number; month: number; day: number } | null {
	const normalized = normalizeOmocodia(taxCode);

	// Year (positions 6-7)
	const yearPart = parseInt(normalized.slice(6, 8), 10);

	// Month (position 8)
	const monthMap: Record<string, number> = {
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
	const monthChar = normalized[8].toUpperCase();
	const month = monthMap[monthChar];

	if (!month) return null;

	// Day (positions 9-10) - females have 40 added
	let day = parseInt(normalized.slice(9, 11), 10);
	if (day > 40) day -= 40;

	// Determine full year (assume 1900s or 2000s based on reasonable range)
	const currentYear = new Date().getFullYear();
	const currentYearShort = currentYear % 100;
	const year = yearPart <= currentYearShort ? 2000 + yearPart : 1900 + yearPart;

	return { year, month, day };
}

// Field validators

export const validators: Record<string, FieldValidator> = {
	firstName: (value: string): ValidationResult => {
		if (!value || value.trim().length === 0) {
			return { valid: false, error: m.validation_first_name_required() };
		}
		if (value.trim().length < 2) {
			return { valid: false, error: m.validation_first_name_min() };
		}
		if (value.trim().length > 50) {
			return { valid: false, error: m.validation_first_name_max() };
		}
		return { valid: true };
	},

	lastName: (value: string): ValidationResult => {
		if (!value || value.trim().length === 0) {
			return { valid: false, error: m.validation_last_name_required() };
		}
		if (value.trim().length < 2) {
			return { valid: false, error: m.validation_last_name_min() };
		}
		if (value.trim().length > 50) {
			return { valid: false, error: m.validation_last_name_max() };
		}
		return { valid: true };
	},

	birthDate: (value: string): ValidationResult => {
		if (!value) {
			return { valid: false, error: m.validation_birth_date_required() };
		}

		const date = new Date(value);
		if (isNaN(date.getTime())) {
			return { valid: false, error: m.validation_birth_date_invalid() };
		}

		const age = calculateAge(date);
		if (age < 16) {
			return { valid: false, error: m.validation_birth_date_under16() };
		}
		if (age > 120) {
			return { valid: false, error: m.validation_birth_date_invalid() };
		}

		return { valid: true };
	},

	nationality: (value: string): ValidationResult => {
		if (!value || value.length === 0) {
			return { valid: false, error: m.validation_nationality_required() };
		}
		if (value.length !== 2) {
			return { valid: false, error: m.validation_nationality_invalid() };
		}
		return { valid: true };
	},

	birthProvince: (value: string): ValidationResult => {
		if (!value || value.length === 0) {
			return { valid: false, error: m.validation_birth_province_required() };
		}
		if (!/^[A-Z]{2}$/i.test(value)) {
			return { valid: false, error: m.validation_birth_province_format() };
		}
		return { valid: true };
	},

	birthCity: (value: string): ValidationResult => {
		if (!value || value.trim().length === 0) {
			return { valid: false, error: m.validation_birth_city_required() };
		}
		if (value.trim().length < 2) {
			return { valid: false, error: m.validation_birth_city_min() };
		}
		if (value.trim().length > 100) {
			return { valid: false, error: m.validation_birth_city_max() };
		}
		return { valid: true };
	},

	gender: (value: string, context?: ValidationContext): ValidationResult => {
		const isForeigner = context?.nationality === 'XX';
		const hasForeignTaxCode = context?.hasForeignTaxCode ?? false;

		// Gender is required for foreigners without tax code
		if (isForeigner && !hasForeignTaxCode) {
			if (!value || value.trim().length === 0) {
				return { valid: false, error: m.validation_gender_required() };
			}
			if (value !== 'M' && value !== 'F') {
				return { valid: false, error: m.validation_gender_invalid() };
			}
		}

		return { valid: true };
	},

	taxCode: (value: string, context?: ValidationContext): ValidationResult => {
		const isItalian = context?.nationality === 'IT';
		const hasForeignTaxCode = context?.hasForeignTaxCode ?? false;
		const shouldValidate = isItalian || hasForeignTaxCode;

		// If not Italian and doesn't have foreign tax code, field is optional
		if (!shouldValidate) {
			return { valid: true };
		}

		// For Italians, tax code is required
		if (isItalian && (!value || value.trim().length === 0)) {
			return { valid: false, error: m.validation_tax_code_required() };
		}

		// If value is provided, validate format
		if (value && value.trim().length > 0) {
			if (!TAX_CODE_REGEX.test(value)) {
				return { valid: false, error: m.validation_tax_code_format() };
			}

			// Validate checksum
			const checksumResult = validateTaxCodeChecksum(value);
			if (!checksumResult.valid) {
				return checksumResult;
			}

			// Validate birth date consistency
			if (context?.birthDate) {
				const birthDate = new Date(context.birthDate);
				if (!isNaN(birthDate.getTime())) {
					const extracted = extractBirthDateFromTaxCode(value);
					if (extracted) {
						const birthYear = birthDate.getFullYear();
						const birthMonth = birthDate.getMonth() + 1;
						const birthDay = birthDate.getDate();

						if (
							extracted.year !== birthYear ||
							extracted.month !== birthMonth ||
							extracted.day !== birthDay
						) {
							return {
								valid: false,
								error: m.validation_tax_code_birth_mismatch()
							};
						}
					}
				}
			}
		}

		return { valid: true };
	},

	address: (value: string): ValidationResult => {
		if (!value || value.trim().length === 0) {
			return { valid: false, error: m.validation_address_required() };
		}
		if (value.trim().length < 5) {
			return { valid: false, error: m.validation_address_min() };
		}
		if (value.trim().length > 200) {
			return { valid: false, error: m.validation_address_max() };
		}
		return { valid: true };
	},

	city: (value: string): ValidationResult => {
		if (!value || value.trim().length === 0) {
			return { valid: false, error: m.validation_city_required() };
		}
		if (value.trim().length < 2) {
			return { valid: false, error: m.validation_city_min() };
		}
		if (value.trim().length > 100) {
			return { valid: false, error: m.validation_city_max() };
		}
		return { valid: true };
	},

	postalCode: (value: string, context?: ValidationContext): ValidationResult => {
		if (!value || value.trim().length === 0) {
			return { valid: false, error: m.validation_postal_code_required() };
		}

		// For Italian residence, must be exactly 5 digits
		const isItalianResidence = context?.residenceCountry === 'IT' || !context?.residenceCountry;
		if (isItalianResidence) {
			if (!/^\d{5}$/.test(value)) {
				return { valid: false, error: m.validation_postal_code_format() };
			}
		} else {
			// For foreign residence, must be exactly "00000" (matches server-side validation)
			if (value !== '00000') {
				return { valid: false, error: m.validation_postal_code_foreign() };
			}
		}

		return { valid: true };
	},

	province: (value: string, context?: ValidationContext): ValidationResult => {
		if (!value || value.trim().length === 0) {
			return { valid: false, error: m.validation_province_required() };
		}
		if (!/^[A-Z]{2}$/i.test(value)) {
			return { valid: false, error: m.validation_province_format() };
		}

		// For foreign residence, province must be "EE"
		const isForeignResidence = context?.residenceCountry && context.residenceCountry !== 'IT';
		if (isForeignResidence && value.toUpperCase() !== 'EE') {
			return { valid: false, error: m.validation_province_foreign() };
		}

		return { valid: true };
	},

	phone: (value: string): ValidationResult => {
		// Phone is optional
		if (!value || value.trim().length === 0) {
			return { valid: true };
		}

		// Expected format: +[prefix][number] where prefix is 1-4 digits and number is 6-15 digits
		// Example: +393331234567
		const cleaned = value.replace(/[\s-]/g, '');

		// Must start with + followed by digits
		if (!/^\+\d{7,19}$/.test(cleaned)) {
			return { valid: false, error: m.validation_phone_format() };
		}

		// Check that after the prefix (1-4 digits) there are at least 6 digits for the number
		// Minimum: +X followed by 6 digits = +XXXXXXX (8 chars)
		// Maximum: +XXXX followed by 15 digits = +XXXXXXXXXXXXXXXXXXX (20 chars)
		if (cleaned.length < 8) {
			return { valid: false, error: m.validation_phone_short() };
		}

		return { valid: true };
	},

	privacyConsent: (value: string): ValidationResult => {
		// Checkbox value comes as 'true' or empty
		if (value !== 'true') {
			return { valid: false, error: m.validation_privacy_required() };
		}
		return { valid: true };
	},

	dataConsent: (value: string): ValidationResult => {
		// Checkbox value comes as 'true' or empty
		if (value !== 'true') {
			return { valid: false, error: m.validation_data_required() };
		}
		return { valid: true };
	}
};

/**
 * Validate tax code checksum
 */
function validateTaxCodeChecksum(taxCode: string): ValidationResult {
	const code = taxCode.toUpperCase();

	const oddValues: Record<string, number> = {
		'0': 1, '1': 0, '2': 5, '3': 7, '4': 9, '5': 13, '6': 15, '7': 17, '8': 19, '9': 21,
		A: 1, B: 0, C: 5, D: 7, E: 9, F: 13, G: 15, H: 17, I: 19, J: 21,
		K: 2, L: 4, M: 18, N: 20, O: 11, P: 3, Q: 6, R: 8, S: 12, T: 14,
		U: 16, V: 10, W: 22, X: 25, Y: 24, Z: 23
	};

	const evenValues: Record<string, number> = {
		'0': 0, '1': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9,
		A: 0, B: 1, C: 2, D: 3, E: 4, F: 5, G: 6, H: 7, I: 8, J: 9,
		K: 10, L: 11, M: 12, N: 13, O: 14, P: 15, Q: 16, R: 17, S: 18, T: 19,
		U: 20, V: 21, W: 22, X: 23, Y: 24, Z: 25
	};

	let sum = 0;
	for (let i = 0; i < 15; i++) {
		const char = code[i];
		if (i % 2 === 0) {
			// Odd position (1-indexed)
			sum += oddValues[char] ?? 0;
		} else {
			// Even position (1-indexed)
			sum += evenValues[char] ?? 0;
		}
	}

	const expectedCheck = String.fromCharCode(65 + (sum % 26));
	const actualCheck = code[15];

	if (expectedCheck !== actualCheck) {
		return { valid: false, error: m.validation_tax_code_checksum() };
	}

	return { valid: true };
}

/**
 * Validate a single field
 */
export function validateField(
	fieldName: string,
	value: string,
	context?: ValidationContext
): ValidationResult {
	const validator = validators[fieldName];
	if (!validator) {
		return { valid: true };
	}
	return validator(value, context);
}

/**
 * Validate multiple fields and return errors object
 */
export function validateFields(
	fields: Record<string, string>,
	context?: ValidationContext
): Record<string, string> {
	const errors: Record<string, string> = {};

	for (const [fieldName, value] of Object.entries(fields)) {
		const result = validateField(fieldName, value, context);
		if (!result.valid && result.error) {
			errors[fieldName] = result.error;
		}
	}

	return errors;
}
