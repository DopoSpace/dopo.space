/**
 * Import Validation Utilities
 *
 * Zod schemas and helper functions for validating and normalizing
 * user import data from AICS files and other sources.
 */

import { z } from 'zod';
import {
	validateTaxCode,
	validateTaxCodeFormat,
	validateTaxCodeConsistency,
	validateTaxCodeNameConsistency,
	suggestCompoundName,
	extractGenderFromTaxCode,
	extractBirthDateFromTaxCode,
	generateTaxCode,
	fixTaxCodeChecksum
} from './tax-code';
import { ITALIAN_NAMES } from '$lib/server/data/italian-names';
import { isValidAge } from '$lib/utils/date';
import {
	compareBirthPlace,
	lookupCadastralCode,
	extractCadastralCodeFromTaxCode,
	findCadastralCodeByCity
} from '$lib/server/data/cadastral-codes';
import { getCityFromCap, getCapFromCity } from '$lib/server/data/italian-cap';
import { inferGenderFromName } from '$lib/server/data/italian-names';
import {
	isValidComuneAICS,
	getOfficialComuneName,
	findComuneByName
} from '$lib/server/data/aics-comuni';
import {
	detectCityCountryRateLimited,
	isGoogleGeocodingConfigured,
	validateAddressRateLimited,
	isGoogleAddressValidationConfigured
} from '$lib/server/integrations/google-address';
import {
	genderizeNameRateLimited,
	isGenderizeConfigured
} from '$lib/server/integrations/genderize';
import type {
	AICSImportRow,
	ValidationResult,
	ProcessedImportRow,
	ImportErrorCode,
	MergeConflict,
	MergeInfo
} from '$lib/types/import';
import { IMPORT_ERROR_MESSAGES } from '$lib/types/import';

/**
 * Known country names mapping (both English and Italian names)
 * Used to detect when province field contains a country name instead of Italian province code
 */
const KNOWN_COUNTRY_NAMES: Record<string, string> = {
	// English names
	'FRANCE': 'Francia',
	'GERMANY': 'Germania',
	'SPAIN': 'Spagna',
	'PORTUGAL': 'Portogallo',
	'UK': 'Regno Unito',
	'UNITED KINGDOM': 'Regno Unito',
	'GREAT BRITAIN': 'Regno Unito',
	'ENGLAND': 'Inghilterra',
	'SCOTLAND': 'Scozia',
	'WALES': 'Galles',
	'IRELAND': 'Irlanda',
	'USA': 'Stati Uniti',
	'UNITED STATES': 'Stati Uniti',
	'UNITED STATES OF AMERICA': 'Stati Uniti',
	'SWITZERLAND': 'Svizzera',
	'AUSTRIA': 'Austria',
	'BELGIUM': 'Belgio',
	'NETHERLANDS': 'Paesi Bassi',
	'HOLLAND': 'Paesi Bassi',
	'POLAND': 'Polonia',
	'ROMANIA': 'Romania',
	'GREECE': 'Grecia',
	'CROATIA': 'Croazia',
	'SLOVENIA': 'Slovenia',
	'CZECH REPUBLIC': 'Repubblica Ceca',
	'CZECHIA': 'Repubblica Ceca',
	'HUNGARY': 'Ungheria',
	'SWEDEN': 'Svezia',
	'NORWAY': 'Norvegia',
	'DENMARK': 'Danimarca',
	'FINLAND': 'Finlandia',
	'RUSSIA': 'Russia',
	'UKRAINE': 'Ucraina',
	'BRAZIL': 'Brasile',
	'ARGENTINA': 'Argentina',
	'MEXICO': 'Messico',
	'CANADA': 'Canada',
	'AUSTRALIA': 'Australia',
	'CHINA': 'Cina',
	'JAPAN': 'Giappone',
	'INDIA': 'India',
	'MOROCCO': 'Marocco',
	'TUNISIA': 'Tunisia',
	'EGYPT': 'Egitto',
	'ALBANIA': 'Albania',
	'SERBIA': 'Serbia',
	'BULGARIA': 'Bulgaria',
	'TURKEY': 'Turchia',
	'LUXEMBOURG': 'Lussemburgo',
	// Italian names (already in Italian, but map them for consistency)
	'FRANCIA': 'Francia',
	'GERMANIA': 'Germania',
	'SPAGNA': 'Spagna',
	'PORTOGALLO': 'Portogallo',
	'REGNO UNITO': 'Regno Unito',
	'INGHILTERRA': 'Inghilterra',
	'IRLANDA': 'Irlanda',
	'STATI UNITI': 'Stati Uniti',
	'SVIZZERA': 'Svizzera',
	'BELGIO': 'Belgio',
	'PAESI BASSI': 'Paesi Bassi',
	'OLANDA': 'Paesi Bassi',
	'POLONIA': 'Polonia',
	'GRECIA': 'Grecia',
	'CROAZIA': 'Croazia',
	'REPUBBLICA CECA': 'Repubblica Ceca',
	'UNGHERIA': 'Ungheria',
	'SVEZIA': 'Svezia',
	'NORVEGIA': 'Norvegia',
	'DANIMARCA': 'Danimarca',
	'FINLANDIA': 'Finlandia',
	'BRASILE': 'Brasile',
	'MESSICO': 'Messico',
	'CINA': 'Cina',
	'GIAPPONE': 'Giappone',
	'MAROCCO': 'Marocco',
	'EGITTO': 'Egitto',
	'TURCHIA': 'Turchia',
	'LUSSEMBURGO': 'Lussemburgo'
};

/**
 * AICS field length limits
 * These are the maximum character lengths allowed in the AICS export format
 */
export const AICS_LIMITS = {
	cognome: 50,
	nome: 50,
	indirizzo: 50,
	comuneNascita: 65,
	comuneResidenza: 65,
	cellulare: 12, // digits only
	email: 50,
	numeroTessera: 10
} as const;

/**
 * Truncate address intelligently to fit AICS limit
 * Tries to truncate at a word boundary if possible
 */
export function truncateAddress(address: string, maxLength: number): string {
	if (!address || address.length <= maxLength) return address;

	// Look for the last space before the max length
	const lastSpace = address.lastIndexOf(' ', maxLength);

	// If we find a space at a reasonable position (at least 60% of max length),
	// truncate at the word boundary
	if (lastSpace > maxLength * 0.6) {
		return address.substring(0, lastSpace);
	}

	// Otherwise, truncate at the exact limit
	return address.substring(0, maxLength);
}

/**
 * Parse Italian date format (DD/MM/YYYY or D/M/YYYY) to Date object
 */
export function parseItalianDate(dateStr: string): Date | null {
	if (!dateStr || typeof dateStr !== 'string') {
		return null;
	}

	const trimmed = dateStr.trim();

	// Try DD/MM/YYYY or D/M/YYYY format
	const match = trimmed.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
	if (match) {
		const [, dayStr, monthStr, yearStr] = match;
		const day = parseInt(dayStr, 10);
		const month = parseInt(monthStr, 10);
		let year = parseInt(yearStr, 10);

		// Handle 2-digit year
		if (year < 100) {
			year = year > 30 ? 1900 + year : 2000 + year;
		}

		// Validate month and day ranges
		if (month < 1 || month > 12 || day < 1 || day > 31) {
			return null;
		}

		// Create date in UTC (month is 0-indexed in JS)
		const date = new Date(Date.UTC(year, month - 1, day));

		// Verify the date is valid (handles edge cases like Feb 30)
		if (
			date.getUTCFullYear() !== year ||
			date.getUTCMonth() !== month - 1 ||
			date.getUTCDate() !== day
		) {
			return null;
		}

		return date;
	}

	// Try ISO format (YYYY-MM-DD)
	const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
	if (isoMatch) {
		const date = new Date(trimmed);
		if (!isNaN(date.getTime())) {
			return date;
		}
	}

	return null;
}

/**
 * Normalize name (Title Case, trim whitespace)
 */
export function normalizeName(name: string): string {
	if (!name) return '';

	return name
		.trim()
		.toLowerCase()
		.replace(/(?:^|\s|-|')\S/g, (char) => char.toUpperCase());
}

/**
 * Normalize email (lowercase, trim)
 */
export function normalizeEmail(email: string): string {
	if (!email) return '';
	return email.trim().toLowerCase();
}

/**
 * Common email domain typo corrections
 */
const EMAIL_DOMAIN_FIXES: Record<string, string> = {
	'gmai.com': 'gmail.com',
	'gmial.com': 'gmail.com',
	'gmail.it': 'gmail.com',
	'gmal.com': 'gmail.com',
	'gamil.com': 'gmail.com',
	'hotmai.com': 'hotmail.com',
	'hotmai.it': 'hotmail.it',
	'hotmal.com': 'hotmail.com',
	'hotmil.com': 'hotmail.com',
	'outloo.com': 'outlook.com',
	'outlok.com': 'outlook.com',
	'outllok.com': 'outlook.com',
	'yahooo.com': 'yahoo.com',
	'yaho.com': 'yahoo.com',
	'yahho.com': 'yahoo.com',
	'libeo.it': 'libero.it',
	'libero.com': 'libero.it',
	'liber.it': 'libero.it'
};

/**
 * Common TLD typo corrections
 */
const TLD_FIXES: Record<string, string> = {
	con: 'com',
	cmo: 'com',
	ocm: 'com',
	vom: 'com',
	iit: 'it',
	ti: 'it',
	iy: 'it'
};

/**
 * Incomplete domain fixes (missing TLD)
 * Maps domain names without TLD to complete domains
 */
const INCOMPLETE_DOMAIN_FIXES: Record<string, string> = {
	gmail: 'gmail.com',
	hotmail: 'hotmail.com',
	outlook: 'outlook.com',
	yahoo: 'yahoo.com',
	libero: 'libero.it',
	virgilio: 'virgilio.it',
	alice: 'alice.it',
	tim: 'tim.it',
	tiscali: 'tiscali.it',
	fastwebnet: 'fastwebnet.it',
	icloud: 'icloud.com',
	live: 'live.com',
	msn: 'msn.com',
	aol: 'aol.com',
	protonmail: 'protonmail.com',
	proton: 'proton.me',
	pec: 'pec.it',
	aruba: 'aruba.it',
	legalmail: 'legalmail.it'
};

/**
 * Try to fix common email typos
 * Returns corrected email if fixable, null otherwise
 */
export function tryFixEmail(email: string): string | null {
	if (!email) return null;

	const normalized = email.trim().toLowerCase();
	const atIndex = normalized.indexOf('@');

	if (atIndex === -1 || atIndex === 0 || atIndex === normalized.length - 1) {
		return null;
	}

	const local = normalized.substring(0, atIndex);
	let domain = normalized.substring(atIndex + 1);

	// Check if domain is incomplete (no dot/TLD) - e.g., "@gmail" → "@gmail.com"
	if (!domain.includes('.')) {
		if (INCOMPLETE_DOMAIN_FIXES[domain]) {
			const fixed = `${local}@${INCOMPLETE_DOMAIN_FIXES[domain]}`;
			if (z.string().email().safeParse(fixed).success) {
				return fixed;
			}
		}
	}

	// Check if full domain is in fixes
	if (EMAIL_DOMAIN_FIXES[domain]) {
		const fixed = `${local}@${EMAIL_DOMAIN_FIXES[domain]}`;
		if (z.string().email().safeParse(fixed).success) {
			return fixed;
		}
	}

	// Check TLD fixes
	const dotIndex = domain.lastIndexOf('.');
	if (dotIndex !== -1) {
		const domainBase = domain.substring(0, dotIndex);
		const tld = domain.substring(dotIndex + 1);

		if (TLD_FIXES[tld]) {
			const fixedDomain = `${domainBase}.${TLD_FIXES[tld]}`;
			const fixed = `${local}@${fixedDomain}`;
			if (z.string().email().safeParse(fixed).success) {
				return fixed;
			}
		}
	}

	return null;
}

/**
 * Format a Date object to Italian date format (DD/MM/YYYY)
 */
export function formatItalianDate(date: Date): string {
	const day = date.getUTCDate().toString().padStart(2, '0');
	const month = (date.getUTCMonth() + 1).toString().padStart(2, '0');
	const year = date.getUTCFullYear();
	return `${day}/${month}/${year}`;
}

/**
 * Result of parsing a date with format detection
 */
export interface DateParseResult {
	date: Date;
	wasSwapped: boolean;
}

/**
 * Parse Italian date with fallback to detect mm/dd/yyyy format
 * Returns the parsed date and whether day/month were swapped
 */
export function parseItalianDateWithFallback(dateStr: string): DateParseResult | null {
	if (!dateStr || typeof dateStr !== 'string') {
		return null;
	}

	// First try standard DD/MM/YYYY
	const normalDate = parseItalianDate(dateStr);
	if (normalDate) {
		return { date: normalDate, wasSwapped: false };
	}

	// Try swapping day/month (MM/DD/YYYY → DD/MM/YYYY)
	const trimmed = dateStr.trim();
	const match = trimmed.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
	if (match) {
		const [, first, second, yearStr] = match;
		const firstNum = parseInt(first, 10);
		const secondNum = parseInt(second, 10);

		// If the first number is > 12, it can't be a month, so no swap possible
		if (firstNum > 12) {
			return null;
		}

		// If second number is <= 12, the swap is ambiguous (could be either format)
		// Only swap if second > 12 (clearly a day) or if first <= 12 and second > 12
		if (secondNum > 12 || (firstNum <= 12 && secondNum <= 31)) {
			// Try swapping: interpret as MM/DD/YYYY and convert to DD/MM/YYYY
			const swapped = `${second}/${first}/${yearStr}`;
			const swappedDate = parseItalianDate(swapped);
			if (swappedDate) {
				return { date: swappedDate, wasSwapped: true };
			}
		}
	}

	return null;
}

/**
 * Normalize phone number to international format
 */
export function normalizePhone(phone: string): string | null {
	if (!phone || typeof phone !== 'string') return null;

	// Remove all non-digit characters except leading +
	let cleaned = phone.trim();

	// If it starts with +, keep it
	const hasPlus = cleaned.startsWith('+');
	cleaned = cleaned.replace(/[^\d]/g, '');

	// If no digits, return null
	if (!cleaned) return null;

	// Add Italian prefix if needed
	if (hasPlus) {
		return `+${cleaned}`;
	}

	// Assume Italian number if no prefix
	if (cleaned.startsWith('39')) {
		return `+${cleaned}`;
	}

	// Add +39 for Italian numbers
	return `+39${cleaned}`;
}

/**
 * Normalize province code to 2 uppercase letters
 */
export function normalizeProvince(province: string): string {
	if (!province) return '';
	return province.trim().toUpperCase().slice(0, 2);
}

/**
 * Normalize postal code (CAP)
 * Italian CAP is 5 digits
 */
export function normalizePostalCode(cap: string): string {
	if (!cap) return '';

	// Remove non-digits
	const digits = cap.replace(/\D/g, '');

	// Pad with leading zeros if needed (some CAPs start with 0)
	return digits.padStart(5, '0').slice(0, 5);
}

/**
 * Common English names for Italian cities mapped to their Italian equivalents
 */
const ENGLISH_TO_ITALIAN_CITIES: Record<string, string> = {
	MILAN: 'Milano',
	ROME: 'Roma',
	FLORENCE: 'Firenze',
	NAPLES: 'Napoli',
	VENICE: 'Venezia',
	TURIN: 'Torino',
	GENOA: 'Genova',
	PADUA: 'Padova',
	MANTUA: 'Mantova',
	SYRACUSE: 'Siracusa',
	LEGHORN: 'Livorno',
	LIVORNO: 'Livorno',
	SARDINIA: 'Sardegna',
	SICILY: 'Sicilia',
	CAPRI: 'Capri',
	AMALFI: 'Amalfi',
	SORRENTO: 'Sorrento',
	PARMA: 'Parma',
	VERONA: 'Verona',
	PISA: 'Pisa',
	SIENA: 'Siena',
	PERUGIA: 'Perugia',
	ASSISI: 'Assisi',
	RAVENNA: 'Ravenna',
	MODENA: 'Modena',
	BOLZANO: 'Bolzano',
	TRENTO: 'Trento',
	TRIESTE: 'Trieste',
	TRENT: 'Trento'
};

/**
 * Italian city name variations mapped to their official ISTAT names
 */
const ITALIAN_CITY_ALIASES: Record<string, string> = {
	// Reggio Emilia variations
	'REGGIO EMILIA': "Reggio nell'Emilia",
	'REGGIO NELL EMILIA': "Reggio nell'Emilia",
	'REGGIO NELLEMILIA': "Reggio nell'Emilia",
	"REGGIO NELL'EMILIA": "Reggio nell'Emilia",
	// Reggio Calabria variations
	'REGGIO CALABRIA': 'Reggio di Calabria',
	'REGGIO DI CALABRIA': 'Reggio di Calabria',
	// Other common variations
	"FORLI'": 'Forlì',
	'FORLI': 'Forlì',
	"FORLI'-CESENA": 'Forlì',
	'SAN DONA DI PIAVE': 'San Donà di Piave',
	"SAN DONA' DI PIAVE": 'San Donà di Piave',
	'CITTA DI CASTELLO': 'Città di Castello',
	"CITTA' DI CASTELLO": 'Città di Castello'
};

/**
 * Normalize birth city from AICS format
 * AICS format includes ISTAT code: "Catania - C351" → "Catania"
 * Also maps English city names to Italian: "Milan" → "Milano"
 * And handles Italian city name variations: "Reggio Emilia" → "Reggio nell'Emilia"
 */
export function normalizeBirthCity(city: string): string {
	if (!city) return '';

	// Remove newlines and normalize whitespace (some files have "Region\nCity" format)
	let trimmed = city.replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();

	// Check if it contains " - " followed by an ISTAT code (letter + digits)
	const match = trimmed.match(/^(.+?)\s*-\s*[A-Z]\d{3}$/i);
	if (match) {
		trimmed = match[1].trim();
	}

	const upperCity = trimmed.toUpperCase();

	// Map English city names to Italian
	if (ENGLISH_TO_ITALIAN_CITIES[upperCity]) {
		return ENGLISH_TO_ITALIAN_CITIES[upperCity];
	}

	// Map Italian city name variations to official ISTAT names
	if (ITALIAN_CITY_ALIASES[upperCity]) {
		return ITALIAN_CITY_ALIASES[upperCity];
	}

	return trimmed;
}

/**
 * Common placeholder values used instead of actual tax codes
 */
const TAX_CODE_PLACEHOLDERS = [
	'-',
	'--',
	'N/A',
	'NA',
	'NESSUNO',
	'NONE',
	'NULL',
	'OLANDA',
	'STRANIERO',
	'ESTERO',
	'FOREIGN',
	'0000000000000000' // 16 zeros placeholder for foreign nationals
];

/**
 * Check if a tax code is an explicit placeholder value (like "-", "N/A", etc.)
 * This is different from isTaxCodePlaceholder which also considers invalid formats.
 */
export function isExplicitTaxCodePlaceholder(taxCode: string): boolean {
	if (!taxCode) return true;

	const upper = taxCode.toUpperCase().trim();
	if (!upper) return true;

	// Check explicit placeholder values
	if (TAX_CODE_PLACEHOLDERS.includes(upper)) {
		return true;
	}

	// Check for non-standard formats (like Swiss AHV number: 756.xxxx.xxxx.xx)
	if (upper.includes('.') && !upper.match(/^[A-Z]{6}/)) {
		return true;
	}

	return false;
}

/**
 * Check if a tax code looks like a placeholder or invalid entry
 */
export function isTaxCodePlaceholder(taxCode: string): boolean {
	if (!taxCode) return true;

	const upper = taxCode.toUpperCase().trim();

	// Check explicit placeholders first
	if (isExplicitTaxCodePlaceholder(taxCode)) {
		return true;
	}

	// Too short or too long
	if (upper.length < 16 || upper.length > 16) {
		return true;
	}

	return false;
}

/**
 * Determine if user is Italian based on birth province
 */
export function isItalianNational(birthProvince: string): boolean {
	if (!birthProvince) return true; // Default to Italian

	const upper = birthProvince.toUpperCase().trim();

	// EE = Estero (foreign)
	return upper !== 'EE';
}

/**
 * Result of merging a single field from two rows
 */
interface MergeFieldResult {
	value: string;
	conflict?: MergeConflict;
}

/**
 * Merge a single field from two rows.
 * Empty values are filled from the other row.
 * If both have different non-empty values, keeps the base value and returns a conflict.
 */
export function mergeField(
	field: string,
	baseValue: string | undefined,
	baseRow: number,
	newValue: string | undefined,
	newRow: number
): MergeFieldResult {
	const baseTrimmed = baseValue?.trim() || '';
	const newTrimmed = newValue?.trim() || '';

	const baseEmpty = baseTrimmed === '';
	const newEmpty = newTrimmed === '';

	// Both empty
	if (baseEmpty && newEmpty) {
		return { value: '' };
	}

	// Base empty, use new value
	if (baseEmpty) {
		return { value: newTrimmed };
	}

	// New empty, keep base value
	if (newEmpty) {
		return { value: baseTrimmed };
	}

	// Both have values - check if they're the same (case-insensitive)
	if (baseTrimmed.toLowerCase() === newTrimmed.toLowerCase()) {
		return { value: baseTrimmed };
	}

	// Conflict: different non-empty values - keep base, report conflict
	return {
		value: baseTrimmed,
		conflict: {
			field,
			usedValue: baseTrimmed,
			usedFromRow: baseRow,
			discardedValue: newTrimmed,
			discardedFromRow: newRow
		}
	};
}

/**
 * Result of merging two import rows
 */
export interface MergeResult {
	merged: AICSImportRow;
	conflicts: MergeConflict[];
}

/**
 * Merge two import rows with the same email.
 * The base row is used as the starting point, and empty fields
 * are filled with values from the new row.
 * Conflicts (different non-empty values) are recorded.
 */
export function mergeImportRows(
	baseRow: AICSImportRow,
	baseRowNumber: number,
	newRow: AICSImportRow,
	newRowNumber: number
): MergeResult {
	const conflicts: MergeConflict[] = [];

	// Helper to merge a field and collect conflicts
	const merge = (field: keyof AICSImportRow): string => {
		const result = mergeField(
			field,
			baseRow[field] as string | undefined,
			baseRowNumber,
			newRow[field] as string | undefined,
			newRowNumber
		);
		if (result.conflict) {
			conflicts.push(result.conflict);
		}
		return result.value;
	};

	const merged: AICSImportRow = {
		cognome: merge('cognome'),
		nome: merge('nome'),
		email: merge('email'),
		dataNascita: merge('dataNascita'),
		sesso: merge('sesso') as 'M' | 'F' | '',
		codiceFiscale: merge('codiceFiscale'),
		provinciaNascita: merge('provinciaNascita'),
		comuneNascita: merge('comuneNascita'),
		indirizzo: merge('indirizzo'),
		cap: merge('cap'),
		provincia: merge('provincia'),
		comune: merge('comune'),
		cellulare: merge('cellulare'),
		numeroTessera: merge('numeroTessera'),
		dataRilascioTessera: merge('dataRilascioTessera'),
		newsletter: merge('newsletter'),
		// Keep the base row number as the canonical row number
		_rowNumber: baseRowNumber
	};

	return { merged, conflicts };
}

/**
 * Information about an existing user in the database
 */
export interface ExistingUserInfo {
	id: string;
	hasActiveMembership: boolean;
}

/**
 * Options for row validation
 */
export interface ValidateRowOptions {
	// Allow adding membership to existing users
	addMembershipToExisting: boolean;
}

/**
 * Validate a single import row and generate validation result
 * This is an async function because it may look up cadastral codes
 *
 * Note: Duplicate email detection within the file is handled at the batch level
 * in validateImportRows, where duplicates are merged before validation.
 */
export async function validateImportRow(
	row: AICSImportRow,
	rowNumber: number,
	existingUsers: Map<string, ExistingUserInfo>, // email -> user info
	mergeInfo: MergeInfo | undefined,
	options: ValidateRowOptions = { addMembershipToExisting: false }
): Promise<ValidationResult> {
	const errors: string[] = [];
	const warnings: string[] = [];
	const correctedData: Partial<AICSImportRow> = {};
	let existingUserId: string | undefined;
	let isExistingUser = false;

	// === Required field validation ===

	// Email
	let email = normalizeEmail(row.email);
	if (!email) {
		errors.push(`${IMPORT_ERROR_MESSAGES.MISSING_REQUIRED_FIELD}: email`);
	} else {
		// Try to fix common email typos first (even for valid-looking emails)
		// Because gmai.com is syntactically valid but wrong
		const fixedEmail = tryFixEmail(email);
		if (fixedEmail && fixedEmail !== email) {
			const originalEmail = email;
			email = fixedEmail;
			correctedData.email = email;
			warnings.push(`Email corretta: ${originalEmail} → ${email}`);
		}

		// Now validate the (possibly corrected) email
		if (!z.string().email().safeParse(email).success) {
			errors.push(IMPORT_ERROR_MESSAGES.INVALID_EMAIL);
		}
	}

	// Continue email validation if we have a valid email now
	if (email && z.string().email().safeParse(email).success) {
		// Check for existing user in database
		const existingUser = existingUsers.get(email);
		if (existingUser) {
			if (options.addMembershipToExisting) {
				// In "add membership to existing" mode
				isExistingUser = true;
				existingUserId = existingUser.id;

				if (existingUser.hasActiveMembership) {
					// User already has active membership - this is a warning, skip
					warnings.push('Utente già presente con membership attiva - verrà saltato');
				} else {
					// User exists but no active membership - we can add one
					warnings.push('Utente esistente - verrà aggiunta solo la membership');
				}
			} else {
				// Normal mode - error on existing user
				errors.push(IMPORT_ERROR_MESSAGES.EMAIL_EXISTS_IN_DB);
			}
		}

		// Only record correction if email was normalized (lowercase/trim) but not fixed above
		if (email !== row.email && !correctedData.email) {
			correctedData.email = email;
		}
	}

	// Name
	const firstName = normalizeName(row.nome);
	if (!firstName || firstName.length < 2) {
		errors.push(`${IMPORT_ERROR_MESSAGES.MISSING_REQUIRED_FIELD}: nome`);
	} else if (firstName !== row.nome) {
		correctedData.nome = firstName;
	}

	// Surname
	const lastName = normalizeName(row.cognome);
	if (!lastName || lastName.length < 2) {
		errors.push(`${IMPORT_ERROR_MESSAGES.MISSING_REQUIRED_FIELD}: cognome`);
	} else if (lastName !== row.cognome) {
		correctedData.cognome = lastName;
	}

	// === AICS field length validation for name fields ===
	if (firstName && firstName.length > AICS_LIMITS.nome) {
		errors.push(`Nome troppo lungo: ${firstName.length} caratteri (max ${AICS_LIMITS.nome})`);
	}
	if (lastName && lastName.length > AICS_LIMITS.cognome) {
		errors.push(`Cognome troppo lungo: ${lastName.length} caratteri (max ${AICS_LIMITS.cognome})`);
	}

	// === Email length validation (AICS max 50) ===
	if (email && email.length > AICS_LIMITS.email) {
		errors.push(`Email troppo lunga: ${email.length} caratteri (max ${AICS_LIMITS.email})`);
	}

	// === Gender validation (AICS: mandatory field) ===
	// Gender is required for AICS export regardless of nationality
	let validatedGender: 'M' | 'F' | null = null;
	const rawSesso = row.sesso?.toUpperCase().trim();
	const rawTaxCode = row.codiceFiscale?.trim().toUpperCase() || '';

	if (rawSesso === 'M' || rawSesso === 'F') {
		validatedGender = rawSesso;
	} else {
		// Step 1: Try to extract gender from tax code if available and valid format
		if (rawTaxCode && !isTaxCodePlaceholder(rawTaxCode) && validateTaxCodeFormat(rawTaxCode)) {
			const extractedGender = extractGenderFromTaxCode(rawTaxCode);
			if (extractedGender) {
				validatedGender = extractedGender;
				correctedData.sesso = extractedGender;
				warnings.push(`Sesso dedotto dal CF: ${extractedGender}`);
			}
		}

		// Step 2: If still no gender, try to infer from first name (local database)
		if (!validatedGender && firstName) {
			const inferredGender = inferGenderFromName(firstName);
			if (inferredGender) {
				validatedGender = inferredGender;
				correctedData.sesso = inferredGender;
				warnings.push(`Sesso dedotto dal nome "${firstName}": ${inferredGender}`);
			}
		}

		// Step 3: If still no gender and Genderize API is available, try external API
		if (!validatedGender && firstName && isGenderizeConfigured()) {
			const apiResult = await genderizeNameRateLimited(firstName);
			if (apiResult.found && apiResult.gender) {
				validatedGender = apiResult.gender;
				correctedData.sesso = apiResult.gender;
				warnings.push(
					`Sesso dedotto da API (${Math.round(apiResult.probability * 100)}%): ${apiResult.gender}`
				);
			}
		}

		// Step 4: If still no gender, it's an error
		if (!validatedGender) {
			errors.push('Sesso obbligatorio (M o F)');
		}
	}

	// === Birth date and tax code validation ===
	// These are processed together because they can correct each other

	// Step 0: Detect foreign birth city and auto-correct provinciaNascita
	// If provinciaNascita is not 'EE' but the birth city is not found in Italian database,
	// use Google Geocoding API to determine the actual country
	let birthProvince = row.provinciaNascita?.toUpperCase().trim() || '';
	let birthCity = row.comuneNascita?.trim() || '';

	// Step 0a: Check if provinciaNascita contains a country name instead of province code
	// Examples: "France", "Germania", "UK" should be corrected to "EE"
	if (birthProvince && birthProvince !== 'EE' && birthProvince.length > 2) {
		const countryName = KNOWN_COUNTRY_NAMES[birthProvince];
		if (countryName) {
			correctedData.provinciaNascita = 'EE';
			warnings.push(`"${row.provinciaNascita}" è un paese - provincia corretta a EE (${countryName})`);
			birthProvince = 'EE';
		}
	}

	if (birthProvince !== 'EE' && birthCity) {
		// Check if the city exists in the Italian cadastral database
		let cadastralCode = await findCadastralCodeByCity(birthCity, birthProvince);

		// If not found, try using Google to resolve city name (translate or normalize)
		if (!cadastralCode && isGoogleGeocodingConfigured()) {
			const geoResult = await detectCityCountryRateLimited(birthCity);

			if (geoResult.found) {
				if (!geoResult.isItalian) {
					// City is foreign - correct province to EE
					birthProvince = 'EE';
					correctedData.provinciaNascita = 'EE';
					warnings.push(
						`Comune di nascita "${birthCity}" in ${geoResult.countryName || geoResult.countryCode} - provincia corretta a EE (estero)`
					);
				} else if (geoResult.cityName && geoResult.cityName.toLowerCase() !== birthCity.toLowerCase()) {
					// Google found an Italian city with different name (translation or variant)
					// Try to look it up with the corrected name
					const italianName = geoResult.cityName;
					cadastralCode = await findCadastralCodeByCity(italianName, birthProvince);
					if (cadastralCode) {
						correctedData.comuneNascita = italianName;
						warnings.push(`Comune "${birthCity}" → "${italianName}"`);
						birthCity = italianName;
					}
				}
				// If geoResult.isItalian is true but cadastral code still not found,
				// it could be a small comune or variant name - don't auto-correct to EE
			} else {
				// Google couldn't find the city - assume foreign
				birthProvince = 'EE';
				correctedData.provinciaNascita = 'EE';
				warnings.push(
					`Comune di nascita "${birthCity}" non trovato - provincia corretta a EE (estero)`
				);
			}
		}

		// If still not found after Google lookup (or Google not configured), assume foreign
		if (!cadastralCode && birthProvince !== 'EE' && !isGoogleGeocodingConfigured()) {
			// No Google API configured - assume foreign if not in Italian DB
			birthProvince = 'EE';
			correctedData.provinciaNascita = 'EE';
			warnings.push(
				`Comune di nascita "${birthCity}" non trovato in Italia - provincia corretta a EE (estero)`
			);
		}
	}

	const isItalian = isItalianNational(birthProvince);
	let taxCode = row.codiceFiscale?.trim().toUpperCase() || '';
	const isPlaceholder = isTaxCodePlaceholder(taxCode);
	let hasValidTaxCode = false;
	let generatedTaxCode = false;

	// Step 1: Parse birth date with format detection
	let birthDate: Date | null = null;
	let birthDateWasSwapped = false;

	const dateParseResult = parseItalianDateWithFallback(row.dataNascita);
	if (dateParseResult) {
		birthDate = dateParseResult.date;
		birthDateWasSwapped = dateParseResult.wasSwapped;
		if (birthDateWasSwapped) {
			correctedData.dataNascita = formatItalianDate(birthDate);
			warnings.push(`Data corretta da formato mm/dd/yyyy: ${row.dataNascita} → ${correctedData.dataNascita}`);
		}
	}

	// Step 2: If birth date parsing failed completely, try to extract from tax code
	if (!birthDate && taxCode && !isPlaceholder && validateTaxCodeFormat(taxCode)) {
		const extractedDate = extractBirthDateFromTaxCode(taxCode);
		if (extractedDate) {
			birthDate = new Date(Date.UTC(extractedDate.year, extractedDate.month - 1, extractedDate.day));
			correctedData.dataNascita = formatItalianDate(birthDate);
			warnings.push(`Data di nascita estratta dal CF: ${correctedData.dataNascita}`);
		}
	}

	// Step 3: Validate tax code (or regenerate if checksum wrong)
	if (isItalian) {
		// Italian citizens must have valid tax code
		// Check if CF is truly missing/placeholder vs present but invalid format
		const rawCfValue = row.codiceFiscale?.trim() || '';
		const isTrulyMissing = !rawCfValue || isExplicitTaxCodePlaceholder(rawCfValue);
		const hasWrongLength = rawCfValue && !isExplicitTaxCodePlaceholder(rawCfValue) && rawCfValue.length !== 16;

		if (!taxCode || isPlaceholder) {
			// Try to generate tax code if we have all required data
			// Use validatedGender from earlier validation
			const canGenerate =
				firstName &&
				lastName &&
				birthDate &&
				validatedGender &&
				birthCity &&
				birthProvince;

			if (canGenerate && birthDate && validatedGender) {
				const generationResult = await generateTaxCode({
					firstName,
					lastName,
					birthDate,
					gender: validatedGender,
					birthCity: normalizeBirthCity(birthCity),
					birthProvince: birthProvince
				});

				if (generationResult.success && generationResult.taxCode) {
					taxCode = generationResult.taxCode;
					correctedData.codiceFiscale = taxCode;
					hasValidTaxCode = true;
					generatedTaxCode = true;
					if (hasWrongLength) {
						// CF was present but had wrong length - mention it was replaced
						warnings.push(`CF non valido (${rawCfValue.length} caratteri invece di 16), rigenerato: ${taxCode}`);
					} else {
						warnings.push(`Codice fiscale generato automaticamente: ${taxCode}`);
					}
				} else {
					// Generation failed - report why
					if (hasWrongLength) {
						// CF was present but invalid format - different message
						errors.push(
							`${IMPORT_ERROR_MESSAGES.INVALID_TAX_CODE}: ${rawCfValue.length} caratteri invece di 16 (rigenerazione fallita: ${generationResult.error})`
						);
					} else {
						errors.push(
							`${IMPORT_ERROR_MESSAGES.TAX_CODE_REQUIRED} (generazione automatica fallita: ${generationResult.error})`
						);
					}
				}
			} else {
				// Missing data for generation - report what's missing
				const missing: string[] = [];
				if (!validatedGender) {
					missing.push('sesso');
				}
				if (!birthCity) {
					missing.push('comune di nascita');
				}
				if (!birthProvince) {
					missing.push('provincia di nascita');
				}

				if (hasWrongLength) {
					// CF was present but has wrong length - different message
					if (missing.length > 0) {
						errors.push(
							`${IMPORT_ERROR_MESSAGES.INVALID_TAX_CODE}: ${rawCfValue.length} caratteri invece di 16 (per rigenerarlo manca: ${missing.join(', ')})`
						);
					} else {
						errors.push(
							`${IMPORT_ERROR_MESSAGES.INVALID_TAX_CODE}: ${rawCfValue.length} caratteri invece di 16`
						);
					}
				} else if (missing.length > 0) {
					errors.push(
						`${IMPORT_ERROR_MESSAGES.TAX_CODE_REQUIRED} (per generarlo automaticamente manca: ${missing.join(', ')})`
					);
				} else {
					errors.push(IMPORT_ERROR_MESSAGES.TAX_CODE_REQUIRED);
				}
			}
		} else {
			const cfValidation = validateTaxCode(taxCode);
			if (!cfValidation.valid) {
				const isChecksumError = cfValidation.error?.includes('controllo');
				const hasValidFormat = validateTaxCodeFormat(taxCode);
				const originalTaxCode = taxCode;

				// Check if we have all data to regenerate the tax code
				// Use validatedGender from earlier validation
				const canFullyRegenerate =
					birthDate &&
					firstName &&
					lastName &&
					validatedGender &&
					birthCity &&
					birthProvince;

				let fixed = false;

				if (isChecksumError && hasValidFormat) {
					// Format is valid but checksum is wrong
					// Try full regeneration first if we have all data
					if (canFullyRegenerate && birthDate && validatedGender) {
						const generationResult = await generateTaxCode({
							firstName,
							lastName,
							birthDate,
							gender: validatedGender,
							birthCity: normalizeBirthCity(birthCity),
							birthProvince: birthProvince
						});

						if (generationResult.success && generationResult.taxCode) {
							taxCode = generationResult.taxCode;
							correctedData.codiceFiscale = taxCode;
							hasValidTaxCode = true;
							generatedTaxCode = true;
							fixed = true;
							warnings.push(
								`CF rigenerato (checksum originale non valido): ${originalTaxCode} → ${taxCode}`
							);
						}
					}

					// If full regeneration wasn't possible or failed, just fix the checksum
					if (!fixed) {
						const fixedTaxCode = fixTaxCodeChecksum(taxCode);
						if (fixedTaxCode) {
							taxCode = fixedTaxCode;
							correctedData.codiceFiscale = taxCode;
							hasValidTaxCode = true;
							fixed = true;
							warnings.push(
								`CF corretto (checksum non valido): ${originalTaxCode} → ${taxCode}`
							);
						}
					}
				} else if (!hasValidFormat && canFullyRegenerate && birthDate && validatedGender) {
					// Format is invalid but we have all data to generate a new CF
					const generationResult = await generateTaxCode({
						firstName,
						lastName,
						birthDate,
						gender: validatedGender,
						birthCity: normalizeBirthCity(birthCity),
						birthProvince: birthProvince
					});

					if (generationResult.success && generationResult.taxCode) {
						taxCode = generationResult.taxCode;
						correctedData.codiceFiscale = taxCode;
						hasValidTaxCode = true;
						generatedTaxCode = true;
						fixed = true;
						warnings.push(
							`CF rigenerato (formato originale non valido): ${originalTaxCode} → ${taxCode}`
						);
					}
				}

				if (!fixed) {
					// Could not fix - report error with details about what's missing
					if (!hasValidFormat && !canFullyRegenerate) {
						const missing: string[] = [];
						if (!birthDate) missing.push('data di nascita');
						if (!firstName) missing.push('nome');
						if (!lastName) missing.push('cognome');
						if (!validatedGender) missing.push('sesso');
						if (!birthCity) missing.push('comune di nascita');
						if (!birthProvince) missing.push('provincia di nascita');
						errors.push(
							`${IMPORT_ERROR_MESSAGES.INVALID_TAX_CODE}: ${cfValidation.error} (per rigenerarlo manca: ${missing.join(', ')})`
						);
					} else {
						errors.push(`${IMPORT_ERROR_MESSAGES.INVALID_TAX_CODE}: ${cfValidation.error}`);
					}
				}
			} else {
				hasValidTaxCode = true;
			}
		}
	} else {
		// Foreign nationals - tax code is optional
		if (taxCode && !isPlaceholder) {
			const cfValidation = validateTaxCode(taxCode);
			if (!cfValidation.valid) {
				warnings.push(`${IMPORT_ERROR_MESSAGES.INVALID_TAX_CODE}: ${cfValidation.error}`);
			} else {
				hasValidTaxCode = true;
			}
		} else {
			warnings.push(IMPORT_ERROR_MESSAGES.MISSING_TAX_CODE_FOREIGN);
		}
	}

	// Step 4: If we have a valid tax code (not generated), check and correct birth date from CF
	if (hasValidTaxCode && taxCode && !generatedTaxCode && birthDate) {
		if (!validateTaxCodeConsistency(taxCode, birthDate)) {
			// Birth date doesn't match CF - extract the correct date from CF
			const cfDate = extractBirthDateFromTaxCode(taxCode);
			if (cfDate) {
				const originalDateStr = correctedData.dataNascita || row.dataNascita;
				birthDate = new Date(Date.UTC(cfDate.year, cfDate.month - 1, cfDate.day));
				correctedData.dataNascita = formatItalianDate(birthDate);
				warnings.push(`Data di nascita corretta dal CF: ${correctedData.dataNascita} (era ${originalDateStr})`);
			}
		}
	}

	// Step 4b: If we have a valid tax code (not generated), check name/surname consistency
	// and try to auto-fix by finding the correct compound name
	if (hasValidTaxCode && taxCode && !generatedTaxCode && firstName && lastName) {
		const nameWarning = validateTaxCodeNameConsistency(taxCode, firstName, lastName);
		if (nameWarning) {
			const suggestedName = suggestCompoundName(taxCode, firstName, ITALIAN_NAMES);
			if (suggestedName) {
				correctedData.nome = suggestedName;
				warnings.push(`Nome corretto dal CF: "${firstName}" → "${suggestedName}"`);
			} else {
				warnings.push(nameWarning);
			}
		}
	}

	// Step 5: Validate birth date (after all corrections)
	if (!birthDate) {
		errors.push(IMPORT_ERROR_MESSAGES.INVALID_DATE);
	} else {
		// Check if in the future
		if (birthDate > new Date()) {
			errors.push(IMPORT_ERROR_MESSAGES.FUTURE_BIRTH_DATE);
		}
		// Check minimum age (16)
		else if (!isValidAge(birthDate)) {
			errors.push(IMPORT_ERROR_MESSAGES.AGE_TOO_YOUNG);
		}
	}

	// === Birth place validation from CF ===
	// If we have a valid tax code (not auto-generated), verify/auto-fill the birth place
	// Skip this if we generated the CF ourselves (we already used the birth place for generation)
	if (hasValidTaxCode && taxCode && !generatedTaxCode) {
		const birthPlaceComparison = await compareBirthPlace(
			taxCode,
			row.comuneNascita || '',
			row.provinciaNascita || ''
		);

		if (birthPlaceComparison.valid && birthPlaceComparison.municipalityFromCF) {
			const cfMunicipality = birthPlaceComparison.municipalityFromCF;

			// Auto-fill birth city if missing
			if (!row.comuneNascita || row.comuneNascita.trim() === '') {
				correctedData.comuneNascita = cfMunicipality.name;
				warnings.push(`Comune di nascita ricavato dal CF: ${cfMunicipality.name}`);
			}
			// Check for city mismatch
			else if (!birthPlaceComparison.cityMatches) {
				warnings.push(
					`Comune di nascita nel file "${normalizeBirthCity(row.comuneNascita)}" diverso da CF "${cfMunicipality.name}"`
				);
				// Suggest correction to CF value
				correctedData.comuneNascita = cfMunicipality.name;
			}

			// Auto-fill birth province if missing
			if (!row.provinciaNascita || row.provinciaNascita.trim() === '') {
				correctedData.provinciaNascita = cfMunicipality.province;
				warnings.push(`Provincia di nascita ricavata dal CF: ${cfMunicipality.province}`);
			}
			// Check for province mismatch (only if not foreign - EE can match any foreign country)
			else if (!birthPlaceComparison.provinceMatches && !cfMunicipality.isForeign) {
				warnings.push(
					`Provincia di nascita nel file "${row.provinciaNascita}" diversa da CF "${cfMunicipality.province}"`
				);
				// Suggest correction to CF value
				correctedData.provinciaNascita = cfMunicipality.province;
			}
		} else if (!birthPlaceComparison.valid && birthPlaceComparison.cadastralCode) {
			// Cadastral code not found in database
			warnings.push(
				`Codice catastale ${birthPlaceComparison.cadastralCode} dal CF non trovato nel database`
			);
		}
	}

	// === Optional field validation ===

	// Province normalization
	const province = normalizeProvince(row.provincia);
	if (province && province !== row.provincia?.toUpperCase().trim()) {
		correctedData.provincia = province;
	}

	// Comune (residence city) - normalize
	let comune = row.comune?.trim() || '';

	// Postal code normalization
	let postalCode = normalizePostalCode(row.cap);
	if (postalCode) {
		// For Italian addresses, CAP should be 5 digits
		if (!/^\d{5}$/.test(postalCode) && province !== 'EE') {
			warnings.push(IMPORT_ERROR_MESSAGES.INVALID_POSTAL_CODE);
		}
		if (postalCode !== row.cap) {
			correctedData.cap = postalCode;
		}
	}

	// === Auto-deduzione CAP e Comune ===

	// If CAP is missing but comune and province are present → deduce CAP
	if (!postalCode && comune && province && province !== 'EE') {
		const deducedCap = getCapFromCity(comune, province);
		if (deducedCap) {
			postalCode = deducedCap;
			correctedData.cap = postalCode;
			warnings.push(`CAP dedotto da comune/provincia: ${postalCode}`);
		}
	}

	// If comune is missing but CAP and province are present → deduce comune
	if (!comune && postalCode && province && province !== 'EE') {
		const deducedCity = getCityFromCap(postalCode, province);
		if (deducedCity) {
			comune = deducedCity;
			correctedData.comune = comune;
			warnings.push(`Comune dedotto da CAP/provincia: ${comune}`);
		}
	}

	// === Google Address Validation ===
	// Validate and normalize Italian residence addresses using Google Address Validation API
	const indirizzo = row.indirizzo?.trim() || '';
	if (
		indirizzo &&
		comune &&
		province &&
		province !== 'EE' &&
		isGoogleAddressValidationConfigured()
	) {
		try {
			const addressResult = await validateAddressRateLimited(
				indirizzo,
				comune,
				province,
				postalCode || ''
			);

			if (addressResult.isValid && addressResult.normalizedAddress) {
				const normalized = addressResult.normalizedAddress;
				let hasCorrections = false;

				// Check and apply corrections for street address
				if (
					normalized.street &&
					normalized.street.toLowerCase() !== indirizzo.toLowerCase()
				) {
					correctedData.indirizzo = normalized.street;
					hasCorrections = true;
				}

				// Check and apply corrections for city
				if (
					normalized.city &&
					normalized.city.toLowerCase() !== comune.toLowerCase()
				) {
					correctedData.comune = normalized.city;
					comune = normalized.city; // Update local variable
					hasCorrections = true;
				}

				// Check and apply corrections for province
				if (
					normalized.province &&
					normalized.province.toUpperCase() !== province.toUpperCase()
				) {
					correctedData.provincia = normalized.province;
					hasCorrections = true;
				}

				// Check and apply corrections for postal code
				if (
					normalized.postalCode &&
					normalized.postalCode !== postalCode
				) {
					correctedData.cap = normalized.postalCode;
					postalCode = normalized.postalCode; // Update local variable
					hasCorrections = true;
				}

				// Add warning about corrections
				if (hasCorrections) {
					if (addressResult.confidence === 'HIGH') {
						warnings.push(
							`Indirizzo normalizzato da Google: ${normalized.formattedAddress}`
						);
					} else {
						warnings.push(
							`Indirizzo corretto da Google (confidenza ${addressResult.confidence}): ${normalized.formattedAddress}`
						);
					}
				}

				// Add any specific corrections from Google
				if (addressResult.suggestedCorrections.length > 0) {
					for (const correction of addressResult.suggestedCorrections) {
						warnings.push(correction);
					}
				}
			} else if (!addressResult.isValid && !addressResult.error) {
				// Address not found or low confidence
				warnings.push(
					`Indirizzo non verificato da Google: "${indirizzo}, ${postalCode || ''} ${comune} ${province}"`
				);
			}
			// If there's an API error, we just skip validation silently (already logged)
		} catch {
			// Silent fail - address validation is optional
		}
	}

	// === AICS Comune Validation ===
	// Validate and normalize residence comune against official AICS database
	// Apply after Google normalization to work with corrected values
	const finalComune = (correctedData.comune as string) || comune;
	const finalProvince = (correctedData.provincia as string) || province;

	if (finalComune && finalProvince && finalProvince !== 'EE') {
		if (!isValidComuneAICS(finalComune, finalProvince)) {
			// Try to find the official name (handles variations, accents, etc.)
			const officialName = getOfficialComuneName(finalComune, finalProvince);

			if (officialName) {
				// Found in AICS database with different spelling
				if (officialName !== finalComune) {
					correctedData.comune = officialName;
					comune = officialName;
					warnings.push(`Comune normalizzato per AICS: "${finalComune}" → "${officialName}"`);
				}
			} else {
				// Not found in AICS - try fuzzy search without province restriction
				const matchWithoutProvince = findComuneByName(finalComune);
				if (matchWithoutProvince) {
					// Found in a different province - might be a data error
					warnings.push(
						`Comune "${finalComune}" non trovato per provincia ${finalProvince}, ` +
						`ma esiste in provincia ${matchWithoutProvince.provinciaCode} - verificare i dati`
					);
				} else {
					// Truly not found in AICS database
					warnings.push(
						`Comune "${finalComune}" non presente nel database AICS per provincia ${finalProvince}`
					);
				}
			}
		} else {
			// Comune is valid in AICS, but might need normalization to exact AICS format
			const officialName = getOfficialComuneName(finalComune, finalProvince);
			if (officialName && officialName !== finalComune) {
				correctedData.comune = officialName;
				comune = officialName;
				warnings.push(`Comune normalizzato per AICS: "${finalComune}" → "${officialName}"`);
			}
		}
	}

	// === AICS address length validation (max 50 chars) ===
	// Apply after Google normalization to check the final address
	const finalAddress = (correctedData.indirizzo as string) || indirizzo;
	if (finalAddress && finalAddress.length > AICS_LIMITS.indirizzo) {
		const truncated = truncateAddress(finalAddress, AICS_LIMITS.indirizzo);
		correctedData.indirizzo = truncated;
		warnings.push(
			`Indirizzo troncato da ${finalAddress.length} a ${AICS_LIMITS.indirizzo} caratteri: "${truncated}"`
		);
	}

	// Phone normalization with AICS length limit (max 12 digits)
	let phone = normalizePhone(row.cellulare);
	if (phone) {
		// AICS requires max 12 digits - extract digits only (without + prefix)
		const phoneDigits = phone.replace(/^\+/, '').replace(/\D/g, '');
		if (phoneDigits.length > AICS_LIMITS.cellulare) {
			// Truncate to 12 digits and re-add prefix
			const truncatedDigits = phoneDigits.slice(0, AICS_LIMITS.cellulare);
			phone = `+${truncatedDigits}`;
			correctedData.cellulare = phone;
			warnings.push(`Cellulare troncato a ${AICS_LIMITS.cellulare} cifre`);
		} else if (phone !== row.cellulare) {
			correctedData.cellulare = phone;
		}
	} else if (row.cellulare && row.cellulare.trim()) {
		warnings.push(IMPORT_ERROR_MESSAGES.INVALID_PHONE);
	}

	// Membership date validation - warn when card number exists but release date is missing
	const hasCardNumber = row.numeroTessera && row.numeroTessera.trim() !== '';
	const hasReleaseDate = row.dataRilascioTessera && row.dataRilascioTessera.trim() !== '';
	if (hasCardNumber && !hasReleaseDate) {
		warnings.push('Data rilascio mancante - verrà impostata alla data di importazione');
	}

	// Determine overall status
	const status = errors.length > 0 ? 'error' : warnings.length > 0 ? 'warning' : 'valid';

	return {
		status,
		errors,
		warnings,
		correctedData,
		originalRow: rowNumber,
		existingUserId,
		isExistingUser,
		mergeInfo
	};
}

/**
 * Convert validated import row to processed format ready for database insertion
 */
export function processImportRow(
	row: AICSImportRow,
	validation: ValidationResult
): ProcessedImportRow | null {
	// Can't process if there are errors
	if (validation.status === 'error') {
		return null;
	}

	// Apply corrections
	const corrected = { ...row, ...validation.correctedData };

	// Parse birth date (use fallback parser for safety)
	const dateResult = parseItalianDateWithFallback(corrected.dataNascita);
	if (!dateResult) {
		return null;
	}
	const birthDate = dateResult.date;

	// Determine nationality
	const isItalian = isItalianNational(corrected.provinciaNascita);
	const nationality = isItalian ? 'IT' : 'XX';

	// Get tax code and gender
	const taxCode = corrected.codiceFiscale?.trim().toUpperCase() || null;
	const hasForeignTaxCode = !isItalian && !!taxCode && !isTaxCodePlaceholder(taxCode || '');

	// Extract gender from tax code or from file
	let gender: 'M' | 'F' | null = null;
	if (taxCode && !isTaxCodePlaceholder(taxCode)) {
		gender = extractGenderFromTaxCode(taxCode);
	}
	if (!gender && corrected.sesso) {
		const sexUpper = corrected.sesso.toUpperCase().trim();
		if (sexUpper === 'M' || sexUpper === 'F') {
			gender = sexUpper;
		}
	}

	// Parse membership date if present
	const membershipStartDate = corrected.dataRilascioTessera
		? parseItalianDate(corrected.dataRilascioTessera)
		: null;

	// Check newsletter subscription preference
	const newsletterValue = corrected.newsletter?.trim().toLowerCase() || '';
	const subscribeToNewsletter = newsletterValue === 'sì' || newsletterValue === 'si' || newsletterValue === 'yes';

	return {
		email: normalizeEmail(corrected.email),
		firstName: normalizeName(corrected.nome),
		lastName: normalizeName(corrected.cognome),
		birthDate,

		nationality,
		birthProvince: normalizeProvince(corrected.provinciaNascita) || (isItalian ? '' : 'EE'),
		birthCity: normalizeBirthCity(corrected.comuneNascita || ''),

		// For foreign nationals without a valid tax code, store null (same as form and admin)
		taxCode: taxCode && !isTaxCodePlaceholder(taxCode) ? taxCode : null,
		hasForeignTaxCode,
		gender,

		address: corrected.indirizzo?.trim() || null,
		city: corrected.comune?.trim() || null,
		postalCode: normalizePostalCode(corrected.cap) || null,
		province: normalizeProvince(corrected.provincia) || null,
		residenceCountry: 'IT',

		phone: normalizePhone(corrected.cellulare),

		membershipNumber: corrected.numeroTessera?.trim() || null,
		membershipStartDate,

		subscribeToNewsletter,

		validationResult: validation
	};
}

/**
 * Zod schema for import row validation (used for form submission)
 */
export const importRowSchema = z.object({
	cognome: z.string().min(2, 'Cognome obbligatorio'),
	nome: z.string().min(2, 'Nome obbligatorio'),
	email: z.string().email('Email non valida'),
	dataNascita: z.string().min(1, 'Data di nascita obbligatoria'),
	sesso: z.enum(['M', 'F', '']).optional().default(''),
	codiceFiscale: z.string().optional().default(''),
	provinciaNascita: z.string().optional().default(''),
	comuneNascita: z.string().optional().default(''),
	indirizzo: z.string().optional().default(''),
	cap: z.string().optional().default(''),
	provincia: z.string().optional().default(''),
	comune: z.string().optional().default(''),
	cellulare: z.string().optional().default(''),
	numeroTessera: z.string().optional().default(''),
	dataRilascioTessera: z.string().optional().default(''),
	newsletter: z.string().optional().default('')
});

/**
 * Zod schema for import options
 */
export const importOptionsSchema = z.object({
	createMembership: z.boolean().default(false),
	skipDuplicateCheck: z.boolean().optional().default(false)
});

/**
 * Generate error summary for import validation
 */
export function generateErrorSummary(results: ValidationResult[]): {
	totalRows: number;
	validCount: number;
	warningCount: number;
	errorCount: number;
	errorsByType: Record<string, number>;
} {
	const errorsByType: Record<string, number> = {};

	let validCount = 0;
	let warningCount = 0;
	let errorCount = 0;

	for (const result of results) {
		switch (result.status) {
			case 'valid':
				validCount++;
				break;
			case 'warning':
				warningCount++;
				break;
			case 'error':
				errorCount++;
				for (const error of result.errors) {
					// Extract error type from message
					const errorType = error.split(':')[0].trim();
					errorsByType[errorType] = (errorsByType[errorType] || 0) + 1;
				}
				break;
		}
	}

	return {
		totalRows: results.length,
		validCount,
		warningCount,
		errorCount,
		errorsByType
	};
}
