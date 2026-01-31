/**
 * Tax Code Generation Tests
 */

import { describe, it, expect } from 'vitest';
import { generateTaxCode, validateTaxCode } from './tax-code';

describe('generateTaxCode', () => {
	it('should generate a valid tax code for a male', async () => {
		const result = await generateTaxCode({
			firstName: 'Mario',
			lastName: 'Rossi',
			birthDate: new Date(Date.UTC(1985, 7, 10)), // 10 Aug 1985
			gender: 'M',
			birthCity: 'Roma',
			birthProvince: 'RM'
		});

		expect(result.success).toBe(true);
		expect(result.taxCode).toBeDefined();
		expect(result.taxCode?.length).toBe(16);

		// Validate the generated tax code
		const validation = validateTaxCode(result.taxCode!);
		expect(validation.valid).toBe(true);
	});

	it('should generate a valid tax code for a female', async () => {
		const result = await generateTaxCode({
			firstName: 'Maria',
			lastName: 'Bianchi',
			birthDate: new Date(Date.UTC(1990, 2, 15)), // 15 Mar 1990
			gender: 'F',
			birthCity: 'Milano',
			birthProvince: 'MI'
		});

		expect(result.success).toBe(true);
		expect(result.taxCode).toBeDefined();

		// Validate the generated tax code
		const validation = validateTaxCode(result.taxCode!);
		expect(validation.valid).toBe(true);

		// Day should be +40 for females (15 + 40 = 55)
		expect(result.taxCode?.substring(9, 11)).toBe('55');
	});

	it('should handle names with few consonants', async () => {
		const result = await generateTaxCode({
			firstName: 'Ugo',
			lastName: 'Aia',
			birthDate: new Date(Date.UTC(2000, 0, 1)), // 1 Jan 2000
			gender: 'M',
			birthCity: 'Torino',
			birthProvince: 'TO'
		});

		expect(result.success).toBe(true);
		expect(result.taxCode).toBeDefined();

		// Validate the generated tax code
		const validation = validateTaxCode(result.taxCode!);
		expect(validation.valid).toBe(true);
	});

	it('should handle names with 4+ consonants correctly', async () => {
		const result = await generateTaxCode({
			firstName: 'Francesco',
			lastName: 'Brambilla',
			birthDate: new Date(Date.UTC(1975, 5, 20)), // 20 Jun 1975
			gender: 'M',
			birthCity: 'Bergamo',
			birthProvince: 'BG'
		});

		expect(result.success).toBe(true);
		expect(result.taxCode).toBeDefined();

		// For name "Francesco" with consonants FRNCSC (6), should use 1st, 3rd, 4th: F, N, C
		expect(result.taxCode?.substring(3, 6)).toBe('FNC');

		// Validate the generated tax code
		const validation = validateTaxCode(result.taxCode!);
		expect(validation.valid).toBe(true);
	});

	it('should fail for unknown city', async () => {
		const result = await generateTaxCode({
			firstName: 'Test',
			lastName: 'User',
			birthDate: new Date(Date.UTC(1990, 0, 1)),
			gender: 'M',
			birthCity: 'Città Inesistente',
			birthProvince: 'XX'
		});

		expect(result.success).toBe(false);
		expect(result.error).toContain('non trovato');
	});

	it('should fail for invalid gender', async () => {
		const result = await generateTaxCode({
			firstName: 'Test',
			lastName: 'User',
			birthDate: new Date(Date.UTC(1990, 0, 1)),
			gender: 'X' as 'M' | 'F',
			birthCity: 'Roma',
			birthProvince: 'RM'
		});

		expect(result.success).toBe(false);
		expect(result.error).toContain('Sesso');
	});
});
