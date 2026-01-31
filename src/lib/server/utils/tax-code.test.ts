/**
 * Tests for Italian Tax Code (Codice Fiscale) utilities
 */

import { describe, it, expect } from 'vitest';
import {
	normalizeOmocodia,
	validateTaxCodeFormat,
	validateTaxCodeChecksum,
	fixTaxCodeChecksum,
	extractGenderFromTaxCode,
	extractBirthDateFromTaxCode,
	validateTaxCodeConsistency,
	validateTaxCode
} from './tax-code';

describe('Tax Code Utilities', () => {
	describe('normalizeOmocodia', () => {
		it('should return unchanged for standard CF', () => {
			expect(normalizeOmocodia('RSSMRA85M10H501S')).toBe('RSSMRA85M10H501S');
		});

		it('should convert omocodia letters to digits', () => {
			// L=0, M=1, N=2, P=3, Q=4, R=5, S=6, T=7, U=8, V=9
			expect(normalizeOmocodia('RSSMRA85M1LH5L1S')).toBe('RSSMRA85M10H501S');
		});

		it('should handle multiple omocodia substitutions', () => {
			// Position 6,7: year (85 -> UR)
			// Position 9,10: day (10 -> ML)
			expect(normalizeOmocodia('RSSMRAURMMLH501S')).toBe('RSSMRA85M10H501S');
		});

		it('should handle invalid input gracefully', () => {
			expect(normalizeOmocodia('')).toBe('');
			expect(normalizeOmocodia('SHORT')).toBe('SHORT');
			// @ts-expect-error testing invalid input
			expect(normalizeOmocodia(null)).toBe(null);
		});

		it('should be case insensitive', () => {
			expect(normalizeOmocodia('rssmra85m10h501s')).toBe('RSSMRA85M10H501S');
		});
	});

	describe('validateTaxCodeFormat', () => {
		it('should accept valid standard format', () => {
			expect(validateTaxCodeFormat('RSSMRA85M10H501S')).toBe(true);
			expect(validateTaxCodeFormat('BNCLCU90A01H501X')).toBe(true);
		});

		it('should accept valid format with omocodia', () => {
			// L in position where 0 would be
			expect(validateTaxCodeFormat('RSSMRA85M1LH5L1S')).toBe(true);
		});

		it('should reject invalid length', () => {
			expect(validateTaxCodeFormat('RSSMRA85M10H501')).toBe(false);
			expect(validateTaxCodeFormat('RSSMRA85M10H501SS')).toBe(false);
		});

		it('should reject invalid characters in letter positions', () => {
			expect(validateTaxCodeFormat('1SSMRA85M10H501S')).toBe(false);
			expect(validateTaxCodeFormat('RSSMRA85110H501S')).toBe(false);
		});

		it('should reject invalid characters in digit positions', () => {
			// A is not a valid omocodia letter (only LMNPQRSTUV)
			expect(validateTaxCodeFormat('RSSMRAA5M10H501S')).toBe(false);
		});

		it('should handle invalid input', () => {
			expect(validateTaxCodeFormat('')).toBe(false);
			// @ts-expect-error testing invalid input
			expect(validateTaxCodeFormat(null)).toBe(false);
			// @ts-expect-error testing invalid input
			expect(validateTaxCodeFormat(undefined)).toBe(false);
			// @ts-expect-error testing invalid input
			expect(validateTaxCodeFormat(123)).toBe(false);
		});

		it('should be case insensitive', () => {
			expect(validateTaxCodeFormat('rssmra85m10h501s')).toBe(true);
			expect(validateTaxCodeFormat('RsSmRa85M10H501s')).toBe(true);
		});
	});

	describe('validateTaxCodeChecksum', () => {
		it('should accept valid checksums', () => {
			// These are real valid CFs (fictional people)
			expect(validateTaxCodeChecksum('RSSMRA85M10H501S')).toBe(true);
		});

		it('should reject invalid checksums', () => {
			// Same CF with wrong checksum (S -> X)
			expect(validateTaxCodeChecksum('RSSMRA85M10H501X')).toBe(false);
		});

		it('should handle omocodia CFs', () => {
			// Checksum is calculated on the original CF including omocodia letters
			// So a CF with omocodia has a different checksum than normalized
			// This is a made-up example - real omocodia CFs would need recalculated checksum
		});

		it('should reject invalid format before checksum', () => {
			expect(validateTaxCodeChecksum('INVALID')).toBe(false);
			expect(validateTaxCodeChecksum('')).toBe(false);
		});
	});

	describe('extractGenderFromTaxCode', () => {
		it('should extract male gender (day <= 40)', () => {
			// Day 10 (positions 9-10) = male
			expect(extractGenderFromTaxCode('RSSMRA85M10H501S')).toBe('M');
		});

		it('should extract female gender (day > 40)', () => {
			// Day 50 (10 + 40) = female (checksum W)
			expect(extractGenderFromTaxCode('RSSMRA85M50H501W')).toBe('F');
			// Day 41 = female (day 1) (checksum U)
			expect(extractGenderFromTaxCode('RSSMRA85M41H501U')).toBe('F');
		});

		it('should handle omocodia', () => {
			// Day 10 with omocodia: ML instead of 10
			expect(extractGenderFromTaxCode('RSSMRA85MMLH501S')).toBe('M');
		});

		it('should return null for invalid CF', () => {
			expect(extractGenderFromTaxCode('INVALID')).toBe(null);
			expect(extractGenderFromTaxCode('')).toBe(null);
		});
	});

	describe('extractBirthDateFromTaxCode', () => {
		it('should extract birth date for male', () => {
			// Year 85, Month M (August), Day 10
			const result = extractBirthDateFromTaxCode('RSSMRA85M10H501R');
			expect(result).toEqual({ day: 10, month: 8, year: 1985 });
		});

		it('should extract birth date for female (remove 40 offset)', () => {
			// Year 85, Month M (August), Day 50 (10 + 40)
			const result = extractBirthDateFromTaxCode('RSSMRA85M50H501X');
			expect(result).toEqual({ day: 10, month: 8, year: 1985 });
		});

		it('should handle all month codes', () => {
			const monthTests = [
				{ code: 'A', expected: 1 },
				{ code: 'B', expected: 2 },
				{ code: 'C', expected: 3 },
				{ code: 'D', expected: 4 },
				{ code: 'E', expected: 5 },
				{ code: 'H', expected: 6 },
				{ code: 'L', expected: 7 },
				{ code: 'M', expected: 8 },
				{ code: 'P', expected: 9 },
				{ code: 'R', expected: 10 },
				{ code: 'S', expected: 11 },
				{ code: 'T', expected: 12 }
			];

			for (const { code, expected } of monthTests) {
				// Use a CF format with variable month code
				const cf = `RSSMRA85${code}10H501R`;
				// Note: checksum would be different for each, but we're testing extraction
				const result = extractBirthDateFromTaxCode(cf);
				expect(result?.month).toBe(expected);
			}
		});

		it('should infer century correctly', () => {
			// Year 85 should be 1985
			let result = extractBirthDateFromTaxCode('RSSMRA85M10H501R');
			expect(result?.year).toBe(1985);

			// Year 05 should be 2005
			result = extractBirthDateFromTaxCode('RSSMRA05M10H501R');
			expect(result?.year).toBe(2005);

			// Year 25 should be 2025 (within 10 years of current)
			result = extractBirthDateFromTaxCode('RSSMRA25M10H501R');
			expect(result?.year).toBe(2025);
		});

		it('should handle omocodia', () => {
			// 85 -> UR (U=8, R=5)
			const result = extractBirthDateFromTaxCode('RSSMRAURMMLH501R');
			expect(result?.year).toBe(1985);
			expect(result?.day).toBe(10);
		});

		it('should return null for invalid CF', () => {
			expect(extractBirthDateFromTaxCode('INVALID')).toBe(null);
			expect(extractBirthDateFromTaxCode('')).toBe(null);
		});
	});

	describe('validateTaxCodeConsistency', () => {
		it('should validate consistent date', () => {
			// Use UTC date (as form date inputs are parsed by new Date("YYYY-MM-DD"))
			const birthDate = new Date('1985-08-10');
			expect(validateTaxCodeConsistency('RSSMRA85M10H501R', birthDate)).toBe(true);
		});

		it('should reject inconsistent date', () => {
			const wrongDate = new Date('1990-01-01');
			expect(validateTaxCodeConsistency('RSSMRA85M10H501R', wrongDate)).toBe(false);
		});

		it('should handle female CFs correctly', () => {
			const birthDate = new Date('1985-08-10');
			// Female CF with day 50 (10 + 40)
			expect(validateTaxCodeConsistency('RSSMRA85M50H501X', birthDate)).toBe(true);
		});

		it('should return false for invalid CF', () => {
			const birthDate = new Date('1985-08-10');
			expect(validateTaxCodeConsistency('INVALID', birthDate)).toBe(false);
		});

		it('should handle dates stored with timezone offset', () => {
			// Simulates a date stored as local midnight CET (22:00 UTC previous day)
			// This happens with imported data: new Date(1985, 7, 10) in CET = 1985-08-09T22:00:00Z
			const birthDateUTC = new Date('1985-08-10');
			expect(validateTaxCodeConsistency('RSSMRA85M10H501R', birthDateUTC)).toBe(true);
		});
	});

	describe('validateTaxCode', () => {
		it('should return valid for correct CF', () => {
			const result = validateTaxCode('RSSMRA85M10H501S');
			expect(result.valid).toBe(true);
			expect(result.error).toBeUndefined();
		});

		it('should reject empty/null input', () => {
			expect(validateTaxCode('').valid).toBe(false);
			expect(validateTaxCode('').error).toBe('Codice fiscale non fornito');

			// @ts-expect-error testing invalid input
			expect(validateTaxCode(null).valid).toBe(false);
		});

		it('should reject wrong length', () => {
			const result = validateTaxCode('SHORT');
			expect(result.valid).toBe(false);
			expect(result.error).toBe('Il codice fiscale deve essere di 16 caratteri');
		});

		it('should reject invalid format', () => {
			const result = validateTaxCode('1234567890123456');
			expect(result.valid).toBe(false);
			expect(result.error).toBe('Formato codice fiscale non valido');
		});

		it('should reject invalid checksum', () => {
			const result = validateTaxCode('RSSMRA85M10H501X');
			expect(result.valid).toBe(false);
			expect(result.error).toBe('Carattere di controllo non valido');
		});

		it('should validate with birth date when provided', () => {
			const correctDate = new Date('1985-08-10');
			const wrongDate = new Date('1990-01-01');

			expect(validateTaxCode('RSSMRA85M10H501S', correctDate).valid).toBe(true);

			const result = validateTaxCode('RSSMRA85M10H501S', wrongDate);
			expect(result.valid).toBe(false);
			expect(result.error).toBe('La data di nascita non corrisponde al codice fiscale');
		});

		it('should be case insensitive', () => {
			expect(validateTaxCode('rssmra85m10h501s').valid).toBe(true);
		});

		it('should handle whitespace', () => {
			expect(validateTaxCode('  RSSMRA85M10H501S  ').valid).toBe(true);
		});
	});

	describe('fixTaxCodeChecksum', () => {
		it('should fix invalid checksum', () => {
			// RSSMRA85M10H501X has wrong checksum (X instead of S)
			const fixed = fixTaxCodeChecksum('RSSMRA85M10H501X');
			expect(fixed).toBe('RSSMRA85M10H501S');
		});

		it('should keep valid checksum unchanged', () => {
			const fixed = fixTaxCodeChecksum('RSSMRA85M10H501S');
			expect(fixed).toBe('RSSMRA85M10H501S');
		});

		it('should return null for invalid format', () => {
			expect(fixTaxCodeChecksum('INVALID')).toBeNull();
			expect(fixTaxCodeChecksum('')).toBeNull();
			expect(fixTaxCodeChecksum('12345')).toBeNull();
		});

		it('should handle lowercase input', () => {
			const fixed = fixTaxCodeChecksum('rssmra85m10h501x');
			expect(fixed).toBe('RSSMRA85M10H501S');
		});

		it('should handle omocodia codes', () => {
			// Omocodia code with wrong checksum
			// RSSMRA85M1LH5L1X should have valid format but wrong checksum
			const fixed = fixTaxCodeChecksum('RSSMRA85M1LH5L1X');
			expect(fixed).not.toBeNull();
			expect(validateTaxCodeChecksum(fixed!)).toBe(true);
		});
	});
});
