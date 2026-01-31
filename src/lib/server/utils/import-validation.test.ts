/**
 * Import Validation Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
	parseItalianDate,
	parseItalianDateWithFallback,
	formatItalianDate,
	tryFixEmail,
	normalizeName,
	normalizeEmail,
	normalizePhone,
	normalizeProvince,
	normalizePostalCode,
	normalizeBirthCity,
	isTaxCodePlaceholder,
	isExplicitTaxCodePlaceholder,
	isItalianNational,
	validateImportRow,
	processImportRow,
	mergeField,
	mergeImportRows,
	truncateAddress,
	AICS_LIMITS,
	type ExistingUserInfo
} from './import-validation';
import { inferGenderFromName } from '$lib/server/data/italian-names';
import type { AICSImportRow } from '$lib/types/import';

describe('parseItalianDate', () => {
	it('should parse DD/MM/YYYY format', () => {
		const date = parseItalianDate('22/08/1984');
		expect(date).toBeInstanceOf(Date);
		expect(date?.getDate()).toBe(22);
		expect(date?.getMonth()).toBe(7); // 0-indexed
		expect(date?.getFullYear()).toBe(1984);
	});

	it('should parse D/M/YYYY format', () => {
		const date = parseItalianDate('1/2/1990');
		expect(date).toBeInstanceOf(Date);
		expect(date?.getDate()).toBe(1);
		expect(date?.getMonth()).toBe(1);
		expect(date?.getFullYear()).toBe(1990);
	});

	it('should return null for invalid date', () => {
		expect(parseItalianDate('')).toBeNull();
		expect(parseItalianDate('invalid')).toBeNull();
		expect(parseItalianDate('32/13/2020')).toBeNull();
	});

	it('should parse ISO format', () => {
		const date = parseItalianDate('1984-08-22');
		expect(date).toBeInstanceOf(Date);
		expect(date?.getDate()).toBe(22);
	});
});

describe('parseItalianDateWithFallback', () => {
	it('should parse standard DD/MM/YYYY format without swap', () => {
		const result = parseItalianDateWithFallback('22/08/1984');
		expect(result).not.toBeNull();
		expect(result?.date.getDate()).toBe(22);
		expect(result?.date.getMonth()).toBe(7);
		expect(result?.date.getFullYear()).toBe(1984);
		expect(result?.wasSwapped).toBe(false);
	});

	it('should detect and swap MM/DD/YYYY format when day > 12', () => {
		// 03/15/1990 should be interpreted as March 15, 1990
		const result = parseItalianDateWithFallback('03/15/1990');
		expect(result).not.toBeNull();
		expect(result?.date.getDate()).toBe(15);
		expect(result?.date.getMonth()).toBe(2); // March (0-indexed)
		expect(result?.date.getFullYear()).toBe(1990);
		expect(result?.wasSwapped).toBe(true);
	});

	it('should handle ambiguous dates (both values <= 12)', () => {
		// 03/05/1990 could be either format - try swap since standard parse fails first
		const result = parseItalianDateWithFallback('03/05/1990');
		expect(result).not.toBeNull();
		// Should parse as DD/MM/YYYY first (3rd of May)
		expect(result?.date.getDate()).toBe(3);
		expect(result?.date.getMonth()).toBe(4); // May (0-indexed)
		expect(result?.wasSwapped).toBe(false);
	});

	it('should return null for completely invalid dates', () => {
		expect(parseItalianDateWithFallback('')).toBeNull();
		expect(parseItalianDateWithFallback('invalid')).toBeNull();
		expect(parseItalianDateWithFallback('32/13/2020')).toBeNull();
	});
});

describe('formatItalianDate', () => {
	it('should format date as DD/MM/YYYY', () => {
		const date = new Date(Date.UTC(1984, 7, 22)); // August 22, 1984
		expect(formatItalianDate(date)).toBe('22/08/1984');
	});

	it('should pad single-digit days and months', () => {
		const date = new Date(Date.UTC(1990, 2, 5)); // March 5, 1990
		expect(formatItalianDate(date)).toBe('05/03/1990');
	});
});

describe('tryFixEmail', () => {
	it('should fix common domain typos', () => {
		expect(tryFixEmail('mario@gmai.com')).toBe('mario@gmail.com');
		expect(tryFixEmail('mario@gmial.com')).toBe('mario@gmail.com');
		expect(tryFixEmail('test@hotmai.com')).toBe('test@hotmail.com');
		expect(tryFixEmail('test@libeo.it')).toBe('test@libero.it');
		expect(tryFixEmail('test@outloo.com')).toBe('test@outlook.com');
	});

	it('should fix common TLD typos', () => {
		expect(tryFixEmail('mario@test.con')).toBe('mario@test.com');
		expect(tryFixEmail('mario@test.cmo')).toBe('mario@test.com');
		expect(tryFixEmail('mario@example.iit')).toBe('mario@example.it');
	});

	it('should return null for unfixable emails', () => {
		expect(tryFixEmail('')).toBeNull();
		expect(tryFixEmail('notanemail')).toBeNull();
		expect(tryFixEmail('@nodomain.com')).toBeNull();
		expect(tryFixEmail('noat.com')).toBeNull();
	});

	it('should return null for valid emails that need no fixing', () => {
		// Valid email - no fix needed, returns null
		expect(tryFixEmail('mario@gmail.com')).toBeNull();
	});

	it('should fix incomplete domains (missing TLD)', () => {
		expect(tryFixEmail('mario@gmail')).toBe('mario@gmail.com');
		expect(tryFixEmail('test@hotmail')).toBe('test@hotmail.com');
		expect(tryFixEmail('user@outlook')).toBe('user@outlook.com');
		expect(tryFixEmail('info@libero')).toBe('info@libero.it');
		expect(tryFixEmail('test@yahoo')).toBe('test@yahoo.com');
		expect(tryFixEmail('user@icloud')).toBe('user@icloud.com');
	});
});

describe('normalizeName', () => {
	it('should capitalize names', () => {
		expect(normalizeName('mario')).toBe('Mario');
		expect(normalizeName('ROSSI')).toBe('Rossi');
		expect(normalizeName('de luca')).toBe('De Luca');
	});

	it('should handle empty input', () => {
		expect(normalizeName('')).toBe('');
	});

	it('should trim whitespace', () => {
		expect(normalizeName('  Mario  ')).toBe('Mario');
	});
});

describe('normalizeEmail', () => {
	it('should lowercase and trim', () => {
		expect(normalizeEmail('Test@Example.COM')).toBe('test@example.com');
		expect(normalizeEmail('  test@test.com  ')).toBe('test@test.com');
	});

	it('should handle empty input', () => {
		expect(normalizeEmail('')).toBe('');
	});
});

describe('normalizePhone', () => {
	it('should add Italian prefix for local numbers', () => {
		expect(normalizePhone('3401234567')).toBe('+393401234567');
	});

	it('should keep existing prefix', () => {
		expect(normalizePhone('+393401234567')).toBe('+393401234567');
	});

	it('should handle numbers with spaces', () => {
		expect(normalizePhone('340 123 4567')).toBe('+393401234567');
	});

	it('should return null for empty input', () => {
		expect(normalizePhone('')).toBeNull();
	});
});

describe('normalizeProvince', () => {
	it('should uppercase and truncate', () => {
		expect(normalizeProvince('mi')).toBe('MI');
		expect(normalizeProvince('MILANO')).toBe('MI');
	});

	it('should handle empty input', () => {
		expect(normalizeProvince('')).toBe('');
	});
});

describe('normalizePostalCode', () => {
	it('should pad with zeros', () => {
		expect(normalizePostalCode('1234')).toBe('01234');
		expect(normalizePostalCode('00100')).toBe('00100');
	});

	it('should remove non-digits', () => {
		expect(normalizePostalCode('20-100')).toBe('20100');
	});

	it('should handle empty input', () => {
		expect(normalizePostalCode('')).toBe('');
	});
});

describe('normalizeBirthCity', () => {
	it('should extract city name from AICS format with ISTAT code', () => {
		expect(normalizeBirthCity('Catania - C351')).toBe('Catania');
		expect(normalizeBirthCity('Verona - L781')).toBe('Verona');
		expect(normalizeBirthCity('Jesi - E388')).toBe('Jesi');
	});

	it('should handle city names without ISTAT code', () => {
		expect(normalizeBirthCity('Milano')).toBe('Milano');
		expect(normalizeBirthCity('Roma')).toBe('Roma');
	});

	it('should handle empty input', () => {
		expect(normalizeBirthCity('')).toBe('');
	});

	it('should trim whitespace', () => {
		expect(normalizeBirthCity('  Catania - C351  ')).toBe('Catania');
		expect(normalizeBirthCity('  Milano  ')).toBe('Milano');
	});

	it('should convert English city names to Italian', () => {
		expect(normalizeBirthCity('Milan')).toBe('Milano');
		expect(normalizeBirthCity('MILAN')).toBe('Milano');
		expect(normalizeBirthCity('Rome')).toBe('Roma');
		expect(normalizeBirthCity('Florence')).toBe('Firenze');
		expect(normalizeBirthCity('Naples')).toBe('Napoli');
		expect(normalizeBirthCity('Venice')).toBe('Venezia');
		expect(normalizeBirthCity('Turin')).toBe('Torino');
		expect(normalizeBirthCity('Genoa')).toBe('Genova');
		expect(normalizeBirthCity('Padua')).toBe('Padova');
	});

	it('should normalize Italian city name variations', () => {
		expect(normalizeBirthCity('Reggio Emilia')).toBe("Reggio nell'Emilia");
		expect(normalizeBirthCity('REGGIO EMILIA')).toBe("Reggio nell'Emilia");
		expect(normalizeBirthCity('reggio emilia')).toBe("Reggio nell'Emilia");
		expect(normalizeBirthCity('Reggio Calabria')).toBe('Reggio di Calabria');
		expect(normalizeBirthCity('Forlì')).toBe('Forlì'); // Already correct
		expect(normalizeBirthCity('Forli')).toBe('Forlì'); // Without accent
	});

	it('should handle newlines and extra whitespace in city names', () => {
		// Newlines are replaced with spaces
		expect(normalizeBirthCity('  reggio\nemilia  ')).toBe("Reggio nell'Emilia");
		expect(normalizeBirthCity('reggio\r\nemilia')).toBe("Reggio nell'Emilia");
		// Multiple spaces are collapsed
		expect(normalizeBirthCity('reggio   emilia')).toBe("Reggio nell'Emilia");
	});
});

describe('isTaxCodePlaceholder', () => {
	it('should detect placeholders', () => {
		expect(isTaxCodePlaceholder('-')).toBe(true);
		expect(isTaxCodePlaceholder('N/A')).toBe(true);
		expect(isTaxCodePlaceholder('OLANDA')).toBe(true);
		expect(isTaxCodePlaceholder('756.0368.6506.66')).toBe(true);
	});

	it('should detect 16 zeros as placeholder for foreign nationals', () => {
		expect(isTaxCodePlaceholder('0000000000000000')).toBe(true);
	});

	it('should not flag valid tax codes', () => {
		expect(isTaxCodePlaceholder('RSSMRA85M10H501S')).toBe(false);
	});
});

describe('isItalianNational', () => {
	it('should return true for Italian provinces', () => {
		expect(isItalianNational('MI')).toBe(true);
		expect(isItalianNational('RM')).toBe(true);
	});

	it('should return false for EE (foreign)', () => {
		expect(isItalianNational('EE')).toBe(false);
	});

	it('should default to true for empty', () => {
		expect(isItalianNational('')).toBe(true);
	});
});

describe('isExplicitTaxCodePlaceholder', () => {
	it('should return true for empty values', () => {
		expect(isExplicitTaxCodePlaceholder('')).toBe(true);
		expect(isExplicitTaxCodePlaceholder('  ')).toBe(true);
	});

	it('should return true for common placeholder strings', () => {
		expect(isExplicitTaxCodePlaceholder('-')).toBe(true);
		expect(isExplicitTaxCodePlaceholder('N/A')).toBe(true);
		expect(isExplicitTaxCodePlaceholder('NESSUNO')).toBe(true);
		expect(isExplicitTaxCodePlaceholder('STRANIERO')).toBe(true);
		expect(isExplicitTaxCodePlaceholder('0000000000000000')).toBe(true);
	});

	it('should return true for non-standard formats like Swiss AHV', () => {
		expect(isExplicitTaxCodePlaceholder('756.0368.6506.66')).toBe(true);
	});

	it('should return false for CFs with wrong length (not explicit placeholders)', () => {
		// 15 characters - wrong length but not an explicit placeholder
		expect(isExplicitTaxCodePlaceholder('FRRSML9520E801P')).toBe(false);
		// 17 characters
		expect(isExplicitTaxCodePlaceholder('FRRSML9520E801PX1')).toBe(false);
	});

	it('should return false for valid-looking tax codes', () => {
		expect(isExplicitTaxCodePlaceholder('RSSMRA85M10H501S')).toBe(false);
	});
});

describe('inferGenderFromName', () => {
	it('should return M for known male names', () => {
		expect(inferGenderFromName('Marco')).toBe('M');
		expect(inferGenderFromName('LUCA')).toBe('M');
		expect(inferGenderFromName('andrea')).toBe('M');
		expect(inferGenderFromName('Samuele')).toBe('M');
		expect(inferGenderFromName('Giuseppe')).toBe('M');
		// D-names that were added
		expect(inferGenderFromName('Diego')).toBe('M');
		expect(inferGenderFromName('Dario')).toBe('M');
		expect(inferGenderFromName('Danilo')).toBe('M');
		expect(inferGenderFromName('Donato')).toBe('M');
		expect(inferGenderFromName('Damiano')).toBe('M');
	});

	it('should return F for known female names', () => {
		expect(inferGenderFromName('Maria')).toBe('F');
		expect(inferGenderFromName('GIULIA')).toBe('F');
		expect(inferGenderFromName('francesca')).toBe('F');
		expect(inferGenderFromName('Valentina')).toBe('F');
	});

	it('should handle compound names by checking first part', () => {
		expect(inferGenderFromName('Maria Teresa')).toBe('F');
		expect(inferGenderFromName('Giuseppe-Antonio')).toBe('M');
		expect(inferGenderFromName('Anna Maria')).toBe('F');
	});

	it('should infer F from common female suffixes', () => {
		expect(inferGenderFromName('Antonella')).toBe('F');
		expect(inferGenderFromName('Giulietta')).toBe('F');
		expect(inferGenderFromName('Catina')).toBe('F'); // -ina suffix
		expect(inferGenderFromName('Brunilde')).toBe('F'); // -ilde suffix
	});

	it('should infer M from common male suffixes', () => {
		expect(inferGenderFromName('Emiliano')).toBe('M'); // -iano suffix
		expect(inferGenderFromName('Marcello')).toBe('M'); // -ello suffix
		expect(inferGenderFromName('Bernardo')).toBe('M'); // -ardo suffix
	});

	it('should return null for unknown names', () => {
		expect(inferGenderFromName('Xyzabc')).toBeNull();
		expect(inferGenderFromName('Sdfgh')).toBeNull();
	});

	it('should return null for empty input', () => {
		expect(inferGenderFromName('')).toBeNull();
		expect(inferGenderFromName('  ')).toBeNull();
	});
});

describe('validateImportRow', () => {
	const baseRow: AICSImportRow = {
		cognome: 'Rossi',
		nome: 'Mario',
		email: 'mario.rossi@example.com',
		dataNascita: '22/08/1984',
		sesso: 'M',
		codiceFiscale: 'RSSMRA84M22H501S',
		provinciaNascita: 'RM',
		comuneNascita: 'Roma',
		indirizzo: 'Via Roma 1',
		cap: '00100',
		provincia: 'RM',
		comune: 'Roma',
		cellulare: '3401234567',
		numeroTessera: '001',
		dataRilascioTessera: '01/01/2024',
		newsletter: ''
	};

	it('should auto-regenerate tax code with invalid checksum', async () => {
		const existingUsers = new Map<string, ExistingUserInfo>();
		const result = await validateImportRow(baseRow, 2, existingUsers, undefined);

		// The example tax code has invalid checksum - it should be regenerated with a warning
		// (not an error anymore, since we have all the data to regenerate it)
		expect(result.status).toBe('warning');
		expect(result.warnings.some((w) => w.toLowerCase().includes('rigenerato'))).toBe(true);
		expect(result.correctedData.codiceFiscale).toBeDefined();
	});

	it('should auto-fix tax code checksum even without birth place data', async () => {
		// Row with invalid checksum CF but missing comuneNascita/provinciaNascita
		// The checksum should be fixed directly without full regeneration
		const row = {
			...baseRow,
			comuneNascita: '', // Missing
			provinciaNascita: '' // Missing
		};
		const existingUsers = new Map<string, ExistingUserInfo>();
		const result = await validateImportRow(row, 2, existingUsers, undefined);

		// Should fix the checksum with a warning
		expect(result.status).toBe('warning');
		expect(result.warnings.some((w) => w.toLowerCase().includes('corretto'))).toBe(true);
		expect(result.correctedData.codiceFiscale).toBeDefined();
	});

	it('should regenerate tax code when format is invalid but all data is available', async () => {
		// Row with invalid format CF - 16 chars but wrong pattern (e.g., all digits where letters expected)
		// Valid format: AAAAAA00A00A000A (6 letters, 2 digits, 1 letter, 2 digits, 1 letter, 3 digits, 1 letter)
		const row = {
			...baseRow,
			codiceFiscale: '1234567890123456' // 16 chars but all digits - invalid format
		};
		const existingUsers = new Map<string, ExistingUserInfo>();
		const result = await validateImportRow(row, 2, existingUsers, undefined);

		// Should regenerate the CF with a warning
		expect(result.status).toBe('warning');
		expect(result.warnings.some((w) => w.includes('formato originale non valido'))).toBe(true);
		expect(result.correctedData.codiceFiscale).toBeDefined();
		expect(result.correctedData.codiceFiscale).toHaveLength(16);
	});

	it('should fail when format is invalid and data is missing for regeneration', async () => {
		// Row with invalid format CF (16 chars but wrong pattern) and missing birth place data
		const row = {
			...baseRow,
			codiceFiscale: '1234567890123456', // 16 chars but invalid format
			comuneNascita: '', // Missing
			provinciaNascita: '' // Missing
		};
		const existingUsers = new Map<string, ExistingUserInfo>();
		const result = await validateImportRow(row, 2, existingUsers, undefined);

		// Should fail with error explaining what's missing
		expect(result.status).toBe('error');
		expect(result.errors.some((e) => e.includes('per rigenerarlo manca'))).toBe(true);
	});

	it('should show "CF non valido" error when CF is present but has wrong length', async () => {
		// Row with CF that is 15 characters (wrong length) and missing data for regeneration
		const row = {
			...baseRow,
			nome: 'Xynthia', // Unknown name, can't infer gender
			codiceFiscale: 'FRRSML9520E801P', // 15 chars - wrong length
			sesso: '' as const, // Missing
			comuneNascita: '', // Missing
			provinciaNascita: '' // Missing
		};
		const existingUsers = new Map<string, ExistingUserInfo>();
		const result = await validateImportRow(row, 2, existingUsers, undefined);

		// Should fail with error that mentions "non valido" instead of "obbligatorio"
		expect(result.status).toBe('error');
		expect(result.errors.some((e) => e.includes('non valido') && e.includes('15 caratteri'))).toBe(true);
		// Should NOT say "obbligatorio" (since CF IS present, just invalid)
		expect(result.errors.some((e) => e.includes('Codice fiscale obbligatorio'))).toBe(false);
	});

	it('should regenerate CF with warning when present but wrong length and all data available', async () => {
		// Row with CF that is 15 characters but all other data is available
		const row = {
			...baseRow,
			codiceFiscale: 'FRRSML9520E801P', // 15 chars - wrong length
			sesso: 'M' as const,
			comuneNascita: 'Roma',
			provinciaNascita: 'RM'
		};
		const existingUsers = new Map<string, ExistingUserInfo>();
		const result = await validateImportRow(row, 2, existingUsers, undefined);

		// Should succeed with warning about regeneration
		expect(result.status).toBe('warning');
		expect(result.warnings.some((w) => w.includes('non valido') && w.includes('15 caratteri'))).toBe(true);
		expect(result.correctedData.codiceFiscale).toBeDefined();
		expect(result.correctedData.codiceFiscale?.length).toBe(16);
	});

	it('should flag missing email', async () => {
		const row = { ...baseRow, email: '' };
		const existingUsers = new Map<string, ExistingUserInfo>();
		const result = await validateImportRow(row, 2, existingUsers, undefined);

		expect(result.status).toBe('error');
		expect(result.errors.some((e) => e.includes('email'))).toBe(true);
	});

	it('should include merge info when provided', async () => {
		// Use a foreigner row to avoid tax code validation errors
		const foreignRow = { ...baseRow, provinciaNascita: 'EE', codiceFiscale: '' };
		const existingUsers = new Map<string, ExistingUserInfo>();
		const mergeInfo = {
			mergedRows: [3, 7, 12],
			conflicts: [
				{
					field: 'cellulare',
					usedValue: '333111',
					usedFromRow: 3,
					discardedValue: '333222',
					discardedFromRow: 7
				}
			]
		};
		const result = await validateImportRow(foreignRow, 3, existingUsers, mergeInfo);

		expect(result.mergeInfo).toBeDefined();
		expect(result.mergeInfo?.mergedRows).toEqual([3, 7, 12]);
		expect(result.mergeInfo?.conflicts).toHaveLength(1);
	});

	it('should flag email existing in database (default mode)', async () => {
		const existingUsers = new Map<string, ExistingUserInfo>([
			['mario.rossi@example.com', { id: 'user-123', hasActiveMembership: false }]
		]);
		const result = await validateImportRow(baseRow, 2, existingUsers, undefined);

		expect(result.status).toBe('error');
		expect(result.errors.some(e => e.includes('registrata'))).toBe(true);
	});

	it('should allow existing users when addMembershipToExisting is true', async () => {
		// Use a foreigner row to avoid tax code validation errors
		const foreignRow = { ...baseRow, provinciaNascita: 'EE', codiceFiscale: '' };
		const existingUsers = new Map<string, ExistingUserInfo>([
			['mario.rossi@example.com', { id: 'user-123', hasActiveMembership: false }]
		]);
		const result = await validateImportRow(foreignRow, 2, existingUsers, undefined, { addMembershipToExisting: true });

		// Should not be an error, but a warning
		expect(result.status).not.toBe('error');
		expect(result.isExistingUser).toBe(true);
		expect(result.existingUserId).toBe('user-123');
		expect(result.warnings.some(e => e.includes('esistente'))).toBe(true);
	});

	it('should warn when existing user already has active membership', async () => {
		// Use a foreigner row to avoid tax code validation errors
		const foreignRow = { ...baseRow, provinciaNascita: 'EE', codiceFiscale: '' };
		const existingUsers = new Map<string, ExistingUserInfo>([
			['mario.rossi@example.com', { id: 'user-123', hasActiveMembership: true }]
		]);
		const result = await validateImportRow(foreignRow, 2, existingUsers, undefined, { addMembershipToExisting: true });

		// Should still be importable but with a warning about active membership
		expect(result.isExistingUser).toBe(true);
		expect(result.warnings.some(e => e.includes('attiva'))).toBe(true);
	});

	it('should auto-generate tax code when missing but data is complete', async () => {
		const row = { ...baseRow, codiceFiscale: '' };
		const existingUsers = new Map<string, ExistingUserInfo>();
		const result = await validateImportRow(row, 2, existingUsers, undefined);

		// Should generate CF automatically and return warning (not error)
		expect(result.status).toBe('warning');
		expect(result.warnings.some(e => e.includes('generato automaticamente'))).toBe(true);
		expect(result.correctedData.codiceFiscale).toBeDefined();
		expect(result.correctedData.codiceFiscale?.length).toBe(16);
	});

	it('should flag missing tax code for Italian when auto-generation cannot proceed', async () => {
		// Missing sesso (gender) AND using a name that can't be inferred - required for CF generation
		const row = { ...baseRow, nome: 'Xynthia', codiceFiscale: '', sesso: '' as const };
		const existingUsers = new Map<string, ExistingUserInfo>();
		const result = await validateImportRow(row, 2, existingUsers, undefined);

		expect(result.status).toBe('error');
		expect(result.errors.some(e => e.includes('obbligatorio'))).toBe(true);
		expect(result.errors.some(e => e.includes('sesso'))).toBe(true);
	});

	it('should infer gender from first name when missing but name is known', async () => {
		// Missing sesso (gender) but using "Mario" which is in our database
		const row = { ...baseRow, codiceFiscale: '', sesso: '' as const };
		const existingUsers = new Map<string, ExistingUserInfo>();
		const result = await validateImportRow(row, 2, existingUsers, undefined);

		// Should NOT be an error - gender inferred from name "Mario"
		expect(result.status).toBe('warning');
		expect(result.errors.some(e => e.includes('Sesso obbligatorio'))).toBe(false);
		expect(result.correctedData.sesso).toBe('M');
		expect(result.warnings.some(w => w.includes('Sesso dedotto dal nome'))).toBe(true);
	});

	it('should warn for missing tax code for foreigner', async () => {
		const row = { ...baseRow, provinciaNascita: 'EE', codiceFiscale: '' };
		const existingUsers = new Map<string, ExistingUserInfo>();
		const result = await validateImportRow(row, 2, existingUsers, undefined);

		// Foreigners can have missing CF (warning, not error)
		expect(result.warnings.some(e => e.includes('straniero'))).toBe(true);
	});

	it('should recognize country names in province field and correct to EE', async () => {
		// Test with "France" in province field (should become EE)
		const row = {
			...baseRow,
			provinciaNascita: 'France',
			comuneNascita: 'Paris',
			codiceFiscale: '' // No CF for foreigners
		};
		const existingUsers = new Map<string, ExistingUserInfo>();
		const result = await validateImportRow(row, 2, existingUsers, undefined);

		// Should have corrected province to EE
		expect(result.correctedData.provinciaNascita).toBe('EE');
		// Should include warning about country detection
		expect(result.warnings.some(w => w.includes('è un paese') || w.includes('Francia'))).toBe(true);
	});

	it('should recognize Italian country names and correct to EE', async () => {
		// Test with "Germania" (Italian for Germany)
		const row = {
			...baseRow,
			provinciaNascita: 'Germania',
			comuneNascita: 'Berlin',
			codiceFiscale: ''
		};
		const existingUsers = new Map<string, ExistingUserInfo>();
		const result = await validateImportRow(row, 2, existingUsers, undefined);

		// Should have corrected province to EE
		expect(result.correctedData.provinciaNascita).toBe('EE');
		expect(result.warnings.some(w => w.includes('è un paese') && w.includes('Germania'))).toBe(true);
	});

	it('should not treat valid Italian province codes as country names', async () => {
		// "RM" is a valid Italian province (Roma), not a country
		const row = {
			...baseRow,
			provinciaNascita: 'RM',
			comuneNascita: 'Roma',
			codiceFiscale: 'RSSMRA85M10H501S'
		};
		const existingUsers = new Map<string, ExistingUserInfo>();
		const result = await validateImportRow(row, 2, existingUsers, undefined);

		// Province should NOT be changed to EE
		expect(result.correctedData.provinciaNascita).not.toBe('EE');
	});

	it('should auto-fill birth city from valid tax code when missing', async () => {
		// Valid tax code for someone born in Roma (H501)
		const row = {
			...baseRow,
			codiceFiscale: 'RSSMRA85M10H501S',
			comuneNascita: '',
			provinciaNascita: ''
		};
		const existingUsers = new Map<string, ExistingUserInfo>();
		const result = await validateImportRow(row, 2, existingUsers, undefined);

		// Should have auto-filled birth city from CF
		expect(result.correctedData.comuneNascita).toBe('Roma');
		expect(result.correctedData.provinciaNascita).toBe('RM');
		expect(result.warnings.some(e => e.includes('ricavato dal CF'))).toBe(true);
	});

	it('should warn when birth city in file differs from tax code', async () => {
		// Tax code says born in Roma (H501), but file says Milano
		const row = {
			...baseRow,
			codiceFiscale: 'RSSMRA85M10H501S',
			comuneNascita: 'Milano',
			provinciaNascita: 'MI'
		};
		const existingUsers = new Map<string, ExistingUserInfo>();
		const result = await validateImportRow(row, 2, existingUsers, undefined);

		// Should warn about mismatch
		expect(result.warnings.some(e => e.includes('diverso da CF'))).toBe(true);
		// Should suggest correction to Roma
		expect(result.correctedData.comuneNascita).toBe('Roma');
	});

	it('should detect foreign birth city and correct province to EE', async () => {
		// Row with a foreign city (Antwerpen) but wrong province (MI)
		const row = {
			...baseRow,
			comuneNascita: 'Antwerpen',
			provinciaNascita: 'MI', // Wrong - should be EE
			codiceFiscale: '' // No tax code
		};
		const existingUsers = new Map<string, ExistingUserInfo>();
		const result = await validateImportRow(row, 2, existingUsers, undefined);

		// Should auto-correct provincia to EE
		expect(result.correctedData.provinciaNascita).toBe('EE');
		expect(result.warnings.some((w) => w.includes('non trovato in Italia'))).toBe(true);
		expect(result.warnings.some((w) => w.includes('provincia corretta a EE'))).toBe(true);
		// Should NOT fail due to missing tax code (foreigner with 0000... placeholder)
		expect(result.status).not.toBe('error');
	});

	it('should assign foreign placeholder tax code when city is detected as foreign', async () => {
		// Row with a foreign city (London) and no tax code
		const row = {
			...baseRow,
			comuneNascita: 'London',
			provinciaNascita: 'RM', // Wrong - should be EE
			codiceFiscale: ''
		};
		const existingUsers = new Map<string, ExistingUserInfo>();
		const result = await validateImportRow(row, 2, existingUsers, undefined);

		// Should detect as foreign and not require Italian tax code
		expect(result.correctedData.provinciaNascita).toBe('EE');
		expect(result.status).not.toBe('error');
	});

	it('should warn when card number exists but release date is missing', async () => {
		// Use a foreigner row to avoid tax code validation errors
		const row = {
			...baseRow,
			provinciaNascita: 'EE',
			codiceFiscale: '',
			numeroTessera: '12345',
			dataRilascioTessera: '' // Missing release date
		};
		const existingUsers = new Map<string, ExistingUserInfo>();
		const result = await validateImportRow(row, 2, existingUsers, undefined);

		// Should warn about missing release date
		expect(result.warnings.some((e) => e.includes('Data rilascio mancante'))).toBe(true);
	});

	it('should not warn about release date when card number is also missing', async () => {
		// Use a foreigner row to avoid tax code validation errors
		const row = {
			...baseRow,
			provinciaNascita: 'EE',
			codiceFiscale: '',
			numeroTessera: '', // No card number
			dataRilascioTessera: '' // No release date either
		};
		const existingUsers = new Map<string, ExistingUserInfo>();
		const result = await validateImportRow(row, 2, existingUsers, undefined);

		// Should NOT warn about missing release date since there's no card number
		expect(result.warnings.some(e => e.includes('Data rilascio mancante'))).toBe(false);
	});

	it('should not warn when both card number and release date are present', async () => {
		// Use a foreigner row to avoid tax code validation errors
		const row = {
			...baseRow,
			provinciaNascita: 'EE',
			codiceFiscale: '',
			numeroTessera: '12345',
			dataRilascioTessera: '01/01/2024' // Has release date
		};
		const existingUsers = new Map<string, ExistingUserInfo>();
		const result = await validateImportRow(row, 2, existingUsers, undefined);

		// Should NOT warn about missing release date
		expect(result.warnings.some(e => e.includes('Data rilascio mancante'))).toBe(false);
	});

	// === Auto-correction test cases ===

	it('should auto-correct email with common typos', async () => {
		const row = {
			...baseRow,
			email: 'mario.rossi@gmai.com', // typo: gmai.com
			provinciaNascita: 'EE',
			codiceFiscale: ''
		};
		const existingUsers = new Map<string, ExistingUserInfo>();
		const result = await validateImportRow(row, 2, existingUsers, undefined);

		// Should not be an error, but a warning
		expect(result.status).not.toBe('error');
		expect(result.correctedData.email).toBe('mario.rossi@gmail.com');
		expect(result.warnings.some(w => w.includes('Email corretta'))).toBe(true);
	});

	it('should auto-correct date in MM/DD/YYYY format', async () => {
		const row = {
			...baseRow,
			dataNascita: '03/15/1990', // MM/DD/YYYY format (March 15)
			provinciaNascita: 'EE',
			codiceFiscale: ''
		};
		const existingUsers = new Map<string, ExistingUserInfo>();
		const result = await validateImportRow(row, 2, existingUsers, undefined);

		// Should correct the date
		expect(result.status).not.toBe('error');
		expect(result.correctedData.dataNascita).toBe('15/03/1990');
		expect(result.warnings.some(w => w.includes('mm/dd/yyyy'))).toBe(true);
	});

	it('should extract birth date from valid tax code when date is missing', async () => {
		// RSSMRA85M10H501S encodes birth date: 10/08/1985
		const row = {
			...baseRow,
			dataNascita: 'invalid-date',
			codiceFiscale: 'RSSMRA85M10H501S',
			comuneNascita: 'Roma',
			provinciaNascita: 'RM'
		};
		const existingUsers = new Map<string, ExistingUserInfo>();
		const result = await validateImportRow(row, 2, existingUsers, undefined);

		// Should extract date from CF
		expect(result.correctedData.dataNascita).toBe('10/08/1985');
		expect(result.warnings.some(w => w.includes('estratta dal CF'))).toBe(true);
	});

	it('should regenerate tax code when checksum is invalid', async () => {
		const row = {
			...baseRow,
			dataNascita: '22/08/1984',
			// This CF has format OK but wrong checksum (S should be something else)
			codiceFiscale: 'RSSMRA84M22H501X',
			comuneNascita: 'Roma',
			provinciaNascita: 'RM',
			sesso: 'M' as const
		};
		const existingUsers = new Map<string, ExistingUserInfo>();
		const result = await validateImportRow(row, 2, existingUsers, undefined);

		// Should regenerate CF with warning
		expect(result.status).not.toBe('error');
		expect(result.correctedData.codiceFiscale).toBeDefined();
		expect(result.correctedData.codiceFiscale?.length).toBe(16);
		expect(result.warnings.some(w => w.includes('rigenerato'))).toBe(true);
	});

	it('should correct birth date from tax code when dates do not match', async () => {
		// Tax code RSSMRA85M10H501S encodes 10/08/1985
		const row = {
			...baseRow,
			dataNascita: '22/08/1984', // Different date!
			codiceFiscale: 'RSSMRA85M10H501S',
			comuneNascita: 'Roma',
			provinciaNascita: 'RM'
		};
		const existingUsers = new Map<string, ExistingUserInfo>();
		const result = await validateImportRow(row, 2, existingUsers, undefined);

		// Should correct date from CF
		expect(result.correctedData.dataNascita).toBe('10/08/1985');
		expect(result.warnings.some(w => w.includes('corretta dal CF') && w.includes('22/08/1984'))).toBe(true);
	});
});

describe('mergeField', () => {
	it('should return empty when both values are empty', () => {
		const result = mergeField('nome', '', 1, '', 2);
		expect(result.value).toBe('');
		expect(result.conflict).toBeUndefined();
	});

	it('should return empty when both values are undefined', () => {
		const result = mergeField('nome', undefined, 1, undefined, 2);
		expect(result.value).toBe('');
		expect(result.conflict).toBeUndefined();
	});

	it('should use new value when base is empty', () => {
		const result = mergeField('nome', '', 1, 'Mario', 2);
		expect(result.value).toBe('Mario');
		expect(result.conflict).toBeUndefined();
	});

	it('should keep base value when new is empty', () => {
		const result = mergeField('nome', 'Mario', 1, '', 2);
		expect(result.value).toBe('Mario');
		expect(result.conflict).toBeUndefined();
	});

	it('should keep base value when both are equal (case-insensitive)', () => {
		const result = mergeField('nome', 'Mario', 1, 'MARIO', 2);
		expect(result.value).toBe('Mario');
		expect(result.conflict).toBeUndefined();
	});

	it('should report conflict when both have different non-empty values', () => {
		const result = mergeField('cognome', 'Rossi', 1, 'Rosi', 2);
		expect(result.value).toBe('Rossi');
		expect(result.conflict).toBeDefined();
		expect(result.conflict?.field).toBe('cognome');
		expect(result.conflict?.usedValue).toBe('Rossi');
		expect(result.conflict?.usedFromRow).toBe(1);
		expect(result.conflict?.discardedValue).toBe('Rosi');
		expect(result.conflict?.discardedFromRow).toBe(2);
	});

	it('should trim values before comparing', () => {
		const result = mergeField('nome', '  Mario  ', 1, 'Mario', 2);
		expect(result.value).toBe('Mario');
		expect(result.conflict).toBeUndefined();
	});
});

describe('mergeImportRows', () => {
	const emptyRow: AICSImportRow = {
		cognome: '',
		nome: '',
		email: '',
		dataNascita: '',
		sesso: '',
		codiceFiscale: '',
		provinciaNascita: '',
		comuneNascita: '',
		indirizzo: '',
		cap: '',
		provincia: '',
		comune: '',
		cellulare: '',
		numeroTessera: '',
		dataRilascioTessera: '',
		newsletter: ''
	};

	it('should merge complementary rows (fill empty fields)', () => {
		const baseRow: AICSImportRow = {
			...emptyRow,
			cognome: 'Rossi',
			nome: 'Mario',
			email: 'mario@test.it',
			dataNascita: '22/08/1984',
			_rowNumber: 3
		};

		const newRow: AICSImportRow = {
			...emptyRow,
			email: 'mario@test.it',
			codiceFiscale: 'RSSMRA84M22H501S',
			indirizzo: 'Via Roma 1',
			cap: '00100',
			_rowNumber: 7
		};

		const { merged, conflicts } = mergeImportRows(baseRow, 3, newRow, 7);

		expect(merged.cognome).toBe('Rossi');
		expect(merged.nome).toBe('Mario');
		expect(merged.email).toBe('mario@test.it');
		expect(merged.dataNascita).toBe('22/08/1984');
		expect(merged.codiceFiscale).toBe('RSSMRA84M22H501S');
		expect(merged.indirizzo).toBe('Via Roma 1');
		expect(merged.cap).toBe('00100');
		expect(merged._rowNumber).toBe(3); // Base row number preserved
		expect(conflicts).toHaveLength(0);
	});

	it('should detect conflicts when both rows have different values', () => {
		const baseRow: AICSImportRow = {
			...emptyRow,
			cognome: 'Rossi',
			nome: 'Mario',
			email: 'mario@test.it',
			cellulare: '333111',
			_rowNumber: 3
		};

		const newRow: AICSImportRow = {
			...emptyRow,
			cognome: 'Rosi', // Different!
			email: 'mario@test.it',
			cellulare: '333222', // Different!
			_rowNumber: 7
		};

		const { merged, conflicts } = mergeImportRows(baseRow, 3, newRow, 7);

		// Should keep base values
		expect(merged.cognome).toBe('Rossi');
		expect(merged.cellulare).toBe('333111');

		// Should have 2 conflicts
		expect(conflicts).toHaveLength(2);

		const cognomeConflict = conflicts.find(c => c.field === 'cognome');
		expect(cognomeConflict).toBeDefined();
		expect(cognomeConflict?.usedValue).toBe('Rossi');
		expect(cognomeConflict?.discardedValue).toBe('Rosi');

		const phoneConflict = conflicts.find(c => c.field === 'cellulare');
		expect(phoneConflict).toBeDefined();
		expect(phoneConflict?.usedValue).toBe('333111');
		expect(phoneConflict?.discardedValue).toBe('333222');
	});

	it('should not report conflict when values are same (case-insensitive)', () => {
		const baseRow: AICSImportRow = {
			...emptyRow,
			cognome: 'Rossi',
			nome: 'MARIO',
			email: 'mario@test.it',
			_rowNumber: 3
		};

		const newRow: AICSImportRow = {
			...emptyRow,
			cognome: 'ROSSI',
			nome: 'Mario',
			email: 'MARIO@TEST.IT',
			_rowNumber: 7
		};

		const { merged, conflicts } = mergeImportRows(baseRow, 3, newRow, 7);

		expect(conflicts).toHaveLength(0);
		expect(merged.cognome).toBe('Rossi');
		expect(merged.nome).toBe('MARIO');
	});

	it('should handle merging three rows sequentially', () => {
		const row1: AICSImportRow = {
			...emptyRow,
			cognome: 'Rossi',
			email: 'mario@test.it',
			_rowNumber: 3
		};

		const row2: AICSImportRow = {
			...emptyRow,
			nome: 'Mario',
			email: 'mario@test.it',
			_rowNumber: 7
		};

		const row3: AICSImportRow = {
			...emptyRow,
			email: 'mario@test.it',
			codiceFiscale: 'RSSMRA84M22H501S',
			_rowNumber: 12
		};

		// First merge: row1 + row2
		const { merged: merged1, conflicts: conflicts1 } = mergeImportRows(row1, 3, row2, 7);
		expect(merged1.cognome).toBe('Rossi');
		expect(merged1.nome).toBe('Mario');
		expect(conflicts1).toHaveLength(0);

		// Second merge: merged1 + row3
		const { merged: merged2, conflicts: conflicts2 } = mergeImportRows(merged1, 3, row3, 12);
		expect(merged2.cognome).toBe('Rossi');
		expect(merged2.nome).toBe('Mario');
		expect(merged2.codiceFiscale).toBe('RSSMRA84M22H501S');
		expect(conflicts2).toHaveLength(0);
	});
});

describe('processImportRow', () => {
	const foreignBaseRow: AICSImportRow = {
		cognome: 'Menendez De La Serna',
		nome: 'Madris Beatriz',
		email: 'beatriz.smenendez@gmail.com',
		dataNascita: '22/01/1990',
		sesso: 'F',
		codiceFiscale: '',
		provinciaNascita: 'EE', // Foreign
		comuneNascita: '',
		indirizzo: '',
		cap: '',
		provincia: '',
		comune: '',
		cellulare: '',
		numeroTessera: '',
		dataRilascioTessera: '',
		newsletter: ''
	};

	it('should assign 16 zeros placeholder to foreign nationals without tax code', async () => {
		const existingUsers = new Map<string, ExistingUserInfo>();
		const validation = await validateImportRow(foreignBaseRow, 2, existingUsers, undefined);

		// Validation should pass (warning for missing CF for foreigner)
		expect(validation.status).not.toBe('error');

		// Process the row
		const processed = processImportRow(foreignBaseRow, validation);

		expect(processed).not.toBeNull();
		expect(processed?.taxCode).toBeNull();
		expect(processed?.nationality).toBe('XX');
	});

	it('should keep valid foreign tax code if provided', async () => {
		const rowWithCF: AICSImportRow = {
			...foreignBaseRow,
			codiceFiscale: 'MNDBTR90A62Z131Z' // Valid foreign CF
		};
		const existingUsers = new Map<string, ExistingUserInfo>();
		const validation = await validateImportRow(rowWithCF, 2, existingUsers, undefined);

		const processed = processImportRow(rowWithCF, validation);

		expect(processed).not.toBeNull();
		expect(processed?.taxCode).toBe('MNDBTR90A62Z131Z');
	});
});

describe('CAP and comune auto-deduction', () => {
	const baseRow: AICSImportRow = {
		cognome: 'Rossi',
		nome: 'Mario',
		email: 'mario.rossi@example.com',
		dataNascita: '10/05/1985',
		sesso: 'M',
		codiceFiscale: 'RSSMRA85E10H501W',
		provinciaNascita: 'RM',
		comuneNascita: 'Roma',
		indirizzo: 'Via Roma 1',
		cap: '00100',
		provincia: 'RM',
		comune: 'Roma',
		cellulare: '3401234567',
		numeroTessera: '001',
		dataRilascioTessera: '01/01/2024',
		newsletter: ''
	};

	it('should deduce CAP from comune and province', async () => {
		const row: AICSImportRow = {
			...baseRow,
			cap: '', // Missing CAP
			comune: 'Milano',
			provincia: 'MI'
		};
		const existingUsers = new Map<string, ExistingUserInfo>();
		const result = await validateImportRow(row, 1, existingUsers, undefined);

		expect(result.status).toBe('warning');
		expect(result.warnings.some((w) => w.includes('CAP dedotto'))).toBe(true);
		expect(result.correctedData?.cap).toBe('20121');
	});

	it('should deduce comune from CAP and province', async () => {
		const row: AICSImportRow = {
			...baseRow,
			cap: '20134',
			comune: '', // Missing comune
			provincia: 'MI'
		};
		const existingUsers = new Map<string, ExistingUserInfo>();
		const result = await validateImportRow(row, 1, existingUsers, undefined);

		expect(result.status).toBe('warning');
		expect(result.warnings.some((w) => w.includes('Comune dedotto'))).toBe(true);
		expect(result.correctedData?.comune).toBe('Milano');
	});

	it('should handle Rome CAP deduction correctly', async () => {
		const row: AICSImportRow = {
			...baseRow,
			cap: '', // Missing CAP
			comune: 'Roma',
			provincia: 'RM'
		};
		const existingUsers = new Map<string, ExistingUserInfo>();
		const result = await validateImportRow(row, 1, existingUsers, undefined);

		expect(result.status).not.toBe('error');
		expect(result.correctedData?.cap).toBe('00118');
	});

	it('should deduce comune from Rome CAP', async () => {
		const row: AICSImportRow = {
			...baseRow,
			cap: '00185', // Rome CAP
			comune: '', // Missing comune
			provincia: 'RM'
		};
		const existingUsers = new Map<string, ExistingUserInfo>();
		const result = await validateImportRow(row, 1, existingUsers, undefined);

		expect(result.status).not.toBe('error');
		expect(result.correctedData?.comune).toBe('Roma');
	});

	it('should not deduce CAP for non-capoluogo cities', async () => {
		const row: AICSImportRow = {
			...baseRow,
			cap: '', // Missing CAP
			comune: 'Sesto San Giovanni', // Not a capoluogo
			provincia: 'MI'
		};
		const existingUsers = new Map<string, ExistingUserInfo>();
		const result = await validateImportRow(row, 1, existingUsers, undefined);

		// CAP remains empty when it can't be deduced - no auto-deduction applied
		expect(result.correctedData?.cap).toBeUndefined();
		// Deduction warning should NOT appear
		expect(result.warnings.some((w) => w.includes('CAP dedotto'))).toBe(false);
	});

	it('should not deduce comune if CAP does not match capoluogo range', async () => {
		const row: AICSImportRow = {
			...baseRow,
			cap: '20099', // CAP outside Milano range (not capoluogo)
			comune: '', // Missing comune
			provincia: 'MI'
		};
		const existingUsers = new Map<string, ExistingUserInfo>();
		const result = await validateImportRow(row, 1, existingUsers, undefined);

		// Comune remains empty when it can't be deduced - no auto-deduction applied
		expect(result.correctedData?.comune).toBeUndefined();
		// Deduction warning should NOT appear
		expect(result.warnings.some((w) => w.includes('Comune dedotto'))).toBe(false);
	});
});

// Mock module for Google Address Validation
vi.mock('$lib/server/integrations/google-address', () => ({
	detectCityCountryRateLimited: vi.fn().mockResolvedValue({
		found: false,
		cityName: null,
		countryCode: null,
		countryName: null,
		isItalian: true
	}),
	isGoogleGeocodingConfigured: vi.fn().mockReturnValue(false),
	validateAddressRateLimited: vi.fn().mockResolvedValue({
		isValid: true,
		normalizedAddress: null,
		confidence: 'NONE',
		suggestedCorrections: []
	}),
	isGoogleAddressValidationConfigured: vi.fn().mockReturnValue(false)
}));

describe('Google Address Validation integration', () => {
	const baseRow: AICSImportRow = {
		nome: 'Mario',
		cognome: 'Rossi',
		email: 'mario.rossi@gmail.com',
		dataNascita: '10/08/1985',
		sesso: 'M',
		comuneNascita: 'Roma',
		provinciaNascita: 'RM',
		codiceFiscale: 'RSSMRA85M10H501S',
		indirizzo: 'Via Roma 1',
		cap: '00185',
		comune: 'Roma',
		provincia: 'RM',
		cellulare: '3331234567',
		numeroTessera: '',
		dataRilascioTessera: '',
		newsletter: 'Sì'
	};

	beforeEach(() => {
		vi.clearAllMocks();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('should skip Google validation when API is not configured', async () => {
		const googleModule = await import('$lib/server/integrations/google-address');
		vi.mocked(googleModule.isGoogleAddressValidationConfigured).mockReturnValue(false);

		const existingUsers = new Map<string, ExistingUserInfo>();
		const result = await validateImportRow(baseRow, 1, existingUsers, undefined);

		expect(result.status).not.toBe('error');
		expect(googleModule.validateAddressRateLimited).not.toHaveBeenCalled();
	});

	it('should apply corrections from Google Address Validation', async () => {
		const googleModule = await import('$lib/server/integrations/google-address');
		vi.mocked(googleModule.isGoogleAddressValidationConfigured).mockReturnValue(true);
		vi.mocked(googleModule.validateAddressRateLimited).mockResolvedValue({
			isValid: true,
			normalizedAddress: {
				street: 'Via Roma, 1',
				city: 'Roma',
				province: 'RM',
				postalCode: '00185',
				country: 'IT',
				formattedAddress: 'Via Roma, 1, 00185 Roma RM, Italia'
			},
			confidence: 'HIGH',
			suggestedCorrections: []
		});

		const row: AICSImportRow = {
			...baseRow,
			indirizzo: 'via roma 1', // Lowercase, missing comma
			cap: '00185',
			comune: 'Roma',
			provincia: 'RM'
		};
		const existingUsers = new Map<string, ExistingUserInfo>();
		const result = await validateImportRow(row, 1, existingUsers, undefined);

		expect(result.status).not.toBe('error');
		expect(result.correctedData?.indirizzo).toBe('Via Roma, 1');
		expect(result.warnings.some((w) => w.includes('normalizzato da Google'))).toBe(true);
	});

	it('should warn when address is not valid with low confidence', async () => {
		const googleModule = await import('$lib/server/integrations/google-address');
		vi.mocked(googleModule.isGoogleAddressValidationConfigured).mockReturnValue(true);
		vi.mocked(googleModule.validateAddressRateLimited).mockResolvedValue({
			isValid: false,
			normalizedAddress: null,
			confidence: 'NONE',
			suggestedCorrections: []
		});

		const row: AICSImportRow = {
			...baseRow,
			indirizzo: 'Via Inesistente 999',
			cap: '00999',
			comune: 'CittàInventata',
			provincia: 'XX'
		};
		const existingUsers = new Map<string, ExistingUserInfo>();
		const result = await validateImportRow(row, 1, existingUsers, undefined);

		// It shouldn't error, just warn
		expect(result.warnings.some((w) => w.includes('non verificato da Google'))).toBe(true);
	});

	it('should correct postal code from Google validation', async () => {
		const googleModule = await import('$lib/server/integrations/google-address');
		vi.mocked(googleModule.isGoogleAddressValidationConfigured).mockReturnValue(true);
		vi.mocked(googleModule.validateAddressRateLimited).mockResolvedValue({
			isValid: true,
			normalizedAddress: {
				street: 'Via Roma, 1',
				city: 'Roma',
				province: 'RM',
				postalCode: '00186', // Different CAP
				country: 'IT',
				formattedAddress: 'Via Roma, 1, 00186 Roma RM, Italia'
			},
			confidence: 'HIGH',
			suggestedCorrections: []
		});

		const row: AICSImportRow = {
			...baseRow,
			indirizzo: 'Via Roma, 1',
			cap: '00185', // Wrong CAP
			comune: 'Roma',
			provincia: 'RM'
		};
		const existingUsers = new Map<string, ExistingUserInfo>();
		const result = await validateImportRow(row, 1, existingUsers, undefined);

		expect(result.correctedData?.cap).toBe('00186');
		expect(result.warnings.some((w) => w.includes('Google'))).toBe(true);
	});

	it('should show correction confidence level', async () => {
		const googleModule = await import('$lib/server/integrations/google-address');
		vi.mocked(googleModule.isGoogleAddressValidationConfigured).mockReturnValue(true);
		vi.mocked(googleModule.validateAddressRateLimited).mockResolvedValue({
			isValid: true,
			normalizedAddress: {
				street: 'Via Roma, 1',
				city: 'Roma',
				province: 'RM',
				postalCode: '00185',
				country: 'IT',
				formattedAddress: 'Via Roma, 1, 00185 Roma RM, Italia'
			},
			confidence: 'MEDIUM', // Medium confidence
			suggestedCorrections: ['Alcuni componenti dell\'indirizzo sono stati dedotti']
		});

		const row: AICSImportRow = {
			...baseRow,
			indirizzo: 'via roma',
			cap: '00185',
			comune: 'Roma',
			provincia: 'RM'
		};
		const existingUsers = new Map<string, ExistingUserInfo>();
		const result = await validateImportRow(row, 1, existingUsers, undefined);

		expect(result.warnings.some((w) => w.includes('confidenza MEDIUM'))).toBe(true);
	});

	it('should not validate addresses for foreign countries (EE province)', async () => {
		const googleModule = await import('$lib/server/integrations/google-address');
		vi.mocked(googleModule.isGoogleAddressValidationConfigured).mockReturnValue(true);

		const row: AICSImportRow = {
			...baseRow,
			indirizzo: '123 Main Street',
			cap: '12345',
			comune: 'New York',
			provincia: 'EE' // Foreign
		};
		const existingUsers = new Map<string, ExistingUserInfo>();
		await validateImportRow(row, 1, existingUsers, undefined);

		// Should not call validation for foreign addresses
		expect(googleModule.validateAddressRateLimited).not.toHaveBeenCalled();
	});
});

describe('truncateAddress', () => {
	it('should return address unchanged if within limit', () => {
		expect(truncateAddress('Via Roma 1', 50)).toBe('Via Roma 1');
	});

	it('should truncate at word boundary when possible', () => {
		const longAddress = 'Via delle Rimembranze di Greco numero civico 27 interno 5';
		const result = truncateAddress(longAddress, 50);
		expect(result.length).toBeLessThanOrEqual(50);
		// Should truncate at a word boundary
		expect(result).toBe('Via delle Rimembranze di Greco numero civico 27');
	});

	it('should truncate at exact limit when no suitable word boundary', () => {
		// An address with very long words that can't be split nicely
		const longWord = 'A'.repeat(60);
		const result = truncateAddress(longWord, 50);
		expect(result.length).toBe(50);
	});

	it('should handle empty string', () => {
		expect(truncateAddress('', 50)).toBe('');
	});
});

describe('AICS compliance validation', () => {
	const baseRow: AICSImportRow = {
		cognome: 'Rossi',
		nome: 'Mario',
		email: 'mario.rossi@example.com',
		dataNascita: '22/08/1984',
		sesso: 'M',
		codiceFiscale: 'RSSMRA85M10H501S', // Valid CF
		provinciaNascita: 'RM',
		comuneNascita: 'Roma',
		indirizzo: 'Via Roma 1',
		cap: '00100',
		provincia: 'RM',
		comune: 'Roma',
		cellulare: '3401234567',
		numeroTessera: '001',
		dataRilascioTessera: '01/01/2024',
		newsletter: ''
	};

	// Re-setup mocks since Google Address Validation tests may have restored them
	beforeEach(async () => {
		const googleModule = await import('$lib/server/integrations/google-address');
		vi.mocked(googleModule.isGoogleAddressValidationConfigured).mockReturnValue(false);
		vi.mocked(googleModule.isGoogleGeocodingConfigured).mockReturnValue(false);
	});

	describe('mandatory gender validation', () => {
		it('should require gender for Italian nationals when name cannot be inferred', async () => {
			const row: AICSImportRow = {
				...baseRow,
				nome: 'Xynthia', // Name not in database
				sesso: '', // Missing gender
				codiceFiscale: '' // No CF to deduce from
			};
			const existingUsers = new Map<string, ExistingUserInfo>();
			const result = await validateImportRow(row, 1, existingUsers, undefined);

			expect(result.status).toBe('error');
			expect(result.errors.some(e => e.includes('Sesso obbligatorio'))).toBe(true);
		});

		it('should require gender for foreign nationals when name cannot be inferred', async () => {
			const row: AICSImportRow = {
				...baseRow,
				nome: 'Xynthia', // Name not in database
				sesso: '', // Missing gender
				provinciaNascita: 'EE', // Foreign
				codiceFiscale: '' // No CF
			};
			const existingUsers = new Map<string, ExistingUserInfo>();
			const result = await validateImportRow(row, 1, existingUsers, undefined);

			expect(result.status).toBe('error');
			expect(result.errors.some(e => e.includes('Sesso obbligatorio'))).toBe(true);
		});

		it('should deduce gender from valid tax code when missing', async () => {
			const row: AICSImportRow = {
				...baseRow,
				sesso: '', // Missing gender
				codiceFiscale: 'RSSMRA85M10H501S' // Valid CF with gender encoded
			};
			const existingUsers = new Map<string, ExistingUserInfo>();
			const result = await validateImportRow(row, 1, existingUsers, undefined);

			// Should NOT be an error - gender deduced from CF
			expect(result.errors.some(e => e.includes('Sesso obbligatorio'))).toBe(false);
			expect(result.correctedData.sesso).toBe('M');
			expect(result.warnings.some(w => w.includes('Sesso dedotto dal CF'))).toBe(true);
		});

		it('should deduce gender from known Italian name when CF is missing', async () => {
			const row: AICSImportRow = {
				...baseRow,
				nome: 'Mario', // Known Italian male name
				sesso: '', // Missing gender
				codiceFiscale: '' // No CF
			};
			const existingUsers = new Map<string, ExistingUserInfo>();
			const result = await validateImportRow(row, 1, existingUsers, undefined);

			// Should NOT be an error - gender deduced from name
			expect(result.errors.some(e => e.includes('Sesso obbligatorio'))).toBe(false);
			expect(result.correctedData.sesso).toBe('M');
			expect(result.warnings.some(w => w.includes('Sesso dedotto dal nome'))).toBe(true);
		});

		it('should deduce gender from known Italian female name', async () => {
			const row: AICSImportRow = {
				...baseRow,
				nome: 'Giulia', // Known Italian female name
				sesso: '', // Missing gender
				provinciaNascita: 'EE', // Foreign
				codiceFiscale: '' // No CF
			};
			const existingUsers = new Map<string, ExistingUserInfo>();
			const result = await validateImportRow(row, 1, existingUsers, undefined);

			// Should NOT be an error - gender deduced from name
			expect(result.errors.some(e => e.includes('Sesso obbligatorio'))).toBe(false);
			expect(result.correctedData.sesso).toBe('F');
			expect(result.warnings.some(w => w.includes('Sesso dedotto dal nome'))).toBe(true);
		});

		it('should not deduce gender from placeholder tax code when name is unknown', async () => {
			const row: AICSImportRow = {
				...baseRow,
				nome: 'Xynthia', // Name not in database
				sesso: '', // Missing gender
				codiceFiscale: '0000000000000000' // Placeholder
			};
			const existingUsers = new Map<string, ExistingUserInfo>();
			const result = await validateImportRow(row, 1, existingUsers, undefined);

			expect(result.status).toBe('error');
			expect(result.errors.some(e => e.includes('Sesso obbligatorio'))).toBe(true);
		});
	});

	describe('field length validation', () => {
		it('should error when first name exceeds 50 characters', async () => {
			const row: AICSImportRow = {
				...baseRow,
				provinciaNascita: 'EE',
				codiceFiscale: '',
				nome: 'A'.repeat(51) // 51 chars
			};
			const existingUsers = new Map<string, ExistingUserInfo>();
			const result = await validateImportRow(row, 1, existingUsers, undefined);

			expect(result.status).toBe('error');
			expect(result.errors.some(e => e.includes('Nome troppo lungo'))).toBe(true);
		});

		it('should error when last name exceeds 50 characters', async () => {
			const row: AICSImportRow = {
				...baseRow,
				provinciaNascita: 'EE',
				codiceFiscale: '',
				cognome: 'B'.repeat(51) // 51 chars
			};
			const existingUsers = new Map<string, ExistingUserInfo>();
			const result = await validateImportRow(row, 1, existingUsers, undefined);

			expect(result.status).toBe('error');
			expect(result.errors.some(e => e.includes('Cognome troppo lungo'))).toBe(true);
		});

		it('should error when email exceeds 50 characters', async () => {
			const row: AICSImportRow = {
				...baseRow,
				provinciaNascita: 'EE',
				codiceFiscale: '',
				email: 'a'.repeat(40) + '@example.com' // 52 chars
			};
			const existingUsers = new Map<string, ExistingUserInfo>();
			const result = await validateImportRow(row, 1, existingUsers, undefined);

			expect(result.status).toBe('error');
			expect(result.errors.some(e => e.includes('Email troppo lunga'))).toBe(true);
		});

		it('should truncate address to 50 characters with warning', async () => {
			const longAddress = 'Via delle Rimembranze di Greco numero civico 27 interno 5 scala B';
			const row: AICSImportRow = {
				...baseRow,
				provinciaNascita: 'EE',
				codiceFiscale: '',
				indirizzo: longAddress
			};
			const existingUsers = new Map<string, ExistingUserInfo>();
			const result = await validateImportRow(row, 1, existingUsers, undefined);

			// Should NOT be an error - address is truncated
			expect(result.status).not.toBe('error');
			expect(result.warnings.some(w => w.includes('Indirizzo troncato'))).toBe(true);
			expect((result.correctedData.indirizzo as string).length).toBeLessThanOrEqual(50);
		});

		it('should truncate phone to 12 digits with warning', async () => {
			const row: AICSImportRow = {
				...baseRow,
				provinciaNascita: 'EE',
				codiceFiscale: '',
				cellulare: '+391234567890123' // 16 digits (without +)
			};
			const existingUsers = new Map<string, ExistingUserInfo>();
			const result = await validateImportRow(row, 1, existingUsers, undefined);

			// Should NOT be an error - phone is truncated
			expect(result.status).not.toBe('error');
			expect(result.warnings.some(w => w.includes('Cellulare troncato'))).toBe(true);
			// Resulting phone should have max 12 digits
			const phoneDigits = (result.correctedData.cellulare as string).replace(/^\+/, '');
			expect(phoneDigits.length).toBeLessThanOrEqual(AICS_LIMITS.cellulare);
		});
	});
});
