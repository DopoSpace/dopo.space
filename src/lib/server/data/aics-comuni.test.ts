/**
 * Tests for AICS Comuni Database
 */
import { describe, it, expect } from 'vitest';
import {
	AICS_COMUNI,
	findComuneByName,
	isValidComuneAICS,
	getComuniByProvincia,
	findComuneByCatastale,
	getOfficialComuneName,
	searchComuni,
	normalizeComuneName
} from './aics-comuni';

describe('AICS Comuni Database', () => {
	describe('AICS_COMUNI data', () => {
		it('should have data loaded', () => {
			expect(AICS_COMUNI.length).toBeGreaterThan(8000);
		});

		it('should have correctly structured records', () => {
			const sample = AICS_COMUNI[0];
			expect(sample).toHaveProperty('regione');
			expect(sample).toHaveProperty('provinciaCode');
			expect(sample).toHaveProperty('provinciaNome');
			expect(sample).toHaveProperty('comune');
			expect(sample).toHaveProperty('codiceCatastale');
			expect(sample).toHaveProperty('codiceIstat');
		});
	});

	describe('normalizeComuneName', () => {
		it('should uppercase and trim', () => {
			expect(normalizeComuneName('  milano  ')).toBe('MILANO');
		});

		it('should remove accents', () => {
			expect(normalizeComuneName('Forlì')).toBe('FORLI');
		});

		it('should normalize apostrophes', () => {
			expect(normalizeComuneName("L'Aquila")).toBe("L'AQUILA");
		});
	});

	describe('findComuneByName', () => {
		it('should find Milano in MI province', () => {
			const result = findComuneByName('Milano', 'MI');
			expect(result).not.toBeNull();
			expect(result?.comune).toBe('Milano');
			expect(result?.provinciaCode).toBe('MI');
		});

		it('should find Roma in RM province', () => {
			const result = findComuneByName('Roma', 'RM');
			expect(result).not.toBeNull();
			expect(result?.comune).toBe('Roma');
		});

		it('should handle case insensitivity', () => {
			const result = findComuneByName('MILANO', 'mi');
			expect(result).not.toBeNull();
			expect(result?.comune).toBe('Milano');
		});

		it('should return null for non-existent comune', () => {
			const result = findComuneByName('NonExistentCity', 'MI');
			expect(result).toBeNull();
		});

		it("should find L'Aquila", () => {
			const result = findComuneByName("L'Aquila", 'AQ');
			expect(result).not.toBeNull();
			expect(result?.comune).toBe("L'Aquila");
		});
	});

	describe('isValidComuneAICS', () => {
		it('should return true for valid comune/provincia combination', () => {
			expect(isValidComuneAICS('Milano', 'MI')).toBe(true);
			expect(isValidComuneAICS('Roma', 'RM')).toBe(true);
			expect(isValidComuneAICS('Torino', 'TO')).toBe(true);
		});

		it('should return false for invalid combination', () => {
			expect(isValidComuneAICS('Milano', 'RM')).toBe(false);
			expect(isValidComuneAICS('NonExistent', 'MI')).toBe(false);
		});

		it('should return true for foreign province (EE)', () => {
			expect(isValidComuneAICS('Paris', 'EE')).toBe(true);
			expect(isValidComuneAICS('Any City', 'EE')).toBe(true);
		});

		it('should return false for empty inputs', () => {
			expect(isValidComuneAICS('', 'MI')).toBe(false);
			expect(isValidComuneAICS('Milano', '')).toBe(false);
		});
	});

	describe('getComuniByProvincia', () => {
		it('should return comuni for a valid province', () => {
			const comuni = getComuniByProvincia('MI');
			expect(comuni.length).toBeGreaterThan(0);
			expect(comuni.every((c) => c.provinciaCode === 'MI')).toBe(true);
		});

		it('should return empty array for invalid province', () => {
			const comuni = getComuniByProvincia('XX');
			expect(comuni).toEqual([]);
		});

		it('should handle case insensitivity', () => {
			const comuni = getComuniByProvincia('mi');
			expect(comuni.length).toBeGreaterThan(0);
		});
	});

	describe('findComuneByCatastale', () => {
		it('should find Milano by cadastral code', () => {
			// Milano has cadastral code F205
			const result = findComuneByCatastale('F205');
			expect(result).not.toBeNull();
			expect(result?.comune).toBe('Milano');
		});

		it('should find Roma by cadastral code', () => {
			// Roma has cadastral code H501
			const result = findComuneByCatastale('H501');
			expect(result).not.toBeNull();
			expect(result?.comune).toBe('Roma');
		});

		it('should return null for non-existent code', () => {
			const result = findComuneByCatastale('XXXX');
			expect(result).toBeNull();
		});
	});

	describe('getOfficialComuneName', () => {
		it('should return official name for valid comune', () => {
			expect(getOfficialComuneName('milano', 'MI')).toBe('Milano');
		});

		it('should return null for non-existent comune', () => {
			expect(getOfficialComuneName('NonExistent', 'MI')).toBeNull();
		});
	});

	describe('searchComuni', () => {
		it('should find comuni matching partial name', () => {
			const results = searchComuni('Mila');
			expect(results.length).toBeGreaterThan(0);
			expect(results.some((c) => c.comune === 'Milano')).toBe(true);
		});

		it('should filter by province when specified', () => {
			const results = searchComuni('San', 'MI', 5);
			expect(results.every((c) => c.provinciaCode === 'MI')).toBe(true);
		});

		it('should respect limit parameter', () => {
			const results = searchComuni('San', undefined, 3);
			expect(results.length).toBeLessThanOrEqual(3);
		});

		it('should return empty for short queries', () => {
			expect(searchComuni('M')).toEqual([]);
		});
	});
});
