/**
 * Import Types
 *
 * TypeScript types for user import functionality.
 * Supports AICS format and generic CSV/Excel imports.
 */

/**
 * Raw row from AICS import file
 * Maps to the standard AICS export template columns
 */
export interface AICSImportRow {
	// Required fields
	cognome: string;
	nome: string;
	email: string;
	dataNascita: string; // "DD/MM/YYYY" or "D/M/YYYY"

	// Personal info
	sesso: 'M' | 'F' | '';
	codiceFiscale: string;

	// Birth place
	provinciaNascita: string; // "MI", "RM", or "EE" for foreign
	comuneNascita: string;

	// Residence
	indirizzo: string;
	cap: string;
	provincia: string; // 2-letter code
	comune: string;

	// Contact
	cellulare: string;

	// Membership info (for reference/import with membership)
	numeroTessera: string;
	dataRilascioTessera: string;

	// Newsletter subscription
	newsletter: string; // "Sì" or "No"

	// Row number in original file (for error reporting)
	_rowNumber?: number;
}

/**
 * Validation status for a single row
 */
export type ValidationStatus = 'valid' | 'warning' | 'error';

/**
 * Conflict detected when merging duplicate rows
 */
export interface MergeConflict {
	field: string; // Field name in conflict
	usedValue: string; // Value that was kept
	usedFromRow: number; // Row number the kept value came from
	discardedValue: string; // Value that was discarded
	discardedFromRow: number; // Row number the discarded value came from
}

/**
 * Information about merged duplicate rows
 */
export interface MergeInfo {
	mergedRows: number[]; // All row numbers that were merged (e.g., [3, 7, 12])
	conflicts: MergeConflict[]; // Any conflicts detected during merge
}

/**
 * Validation result for a single import row
 */
export interface ValidationResult {
	status: ValidationStatus;
	errors: string[]; // Blocking errors - row cannot be imported
	warnings: string[]; // Non-blocking issues - row can be imported with warnings
	correctedData: Partial<AICSImportRow>; // Auto-corrected fields
	originalRow: number; // 1-based row number in original file
	isDuplicate?: boolean; // True if duplicate email in file
	duplicateOfRow?: number; // Row number of first occurrence if duplicate
	existingUserId?: string; // User ID if email exists in DB (for addMembershipToExisting mode)
	isExistingUser?: boolean; // True if user already exists in database
	mergeInfo?: MergeInfo; // Info about merged rows if this record was created from multiple rows
}

/**
 * Processed row ready for import
 * Contains validated and normalized data
 */
export interface ProcessedImportRow {
	// Required fields (validated)
	email: string;
	firstName: string;
	lastName: string;
	birthDate: Date;

	// Nationality and birth place
	nationality: string; // "IT" or "XX" for foreign
	birthProvince: string; // 2-letter code or "EE"
	birthCity: string;

	// Tax code (may be empty for foreigners)
	taxCode: string | null;
	hasForeignTaxCode: boolean;

	// Gender (derived from CF or from file)
	gender: 'M' | 'F' | null;

	// Residence
	address: string | null;
	city: string | null;
	postalCode: string | null;
	province: string | null;
	residenceCountry: string; // Default "IT"

	// Contact
	phone: string | null;

	// Membership info (if importing with membership)
	membershipNumber: string | null;
	membershipStartDate: Date | null;

	// Newsletter subscription
	subscribeToNewsletter: boolean;

	// Validation status
	validationResult: ValidationResult;
}

/**
 * Import options
 */
export interface ImportOptions {
	// Create membership along with user
	createMembership: boolean;

	// Add membership to existing users (instead of skipping them)
	addMembershipToExisting: boolean;

	// Skip duplicate email check in DB (for testing)
	skipDuplicateCheck?: boolean;
}

/**
 * Individual import result for a single row
 */
export interface RowImportResult {
	rowNumber: number;
	success: boolean;
	userId?: string;
	membershipId?: string;
	email: string;
	firstName: string;
	lastName: string;
	error?: string;
	// Newsletter subscription result
	newsletterSubscribed?: boolean;
	newsletterError?: string;
	// Full data for report generation
	originalData?: AICSImportRow;
	processedData?: ProcessedImportRow;
}

/**
 * Overall import result
 */
export interface ImportResult {
	success: boolean;
	totalRows: number;
	importedCount: number;
	skippedCount: number;
	errorCount: number;
	results: RowImportResult[];
	errors: Array<{
		rowNumber: number;
		email: string;
		errors: string[];
	}>;
	warnings: Array<{
		rowNumber: number;
		email: string;
		warnings: string[];
	}>;
	// Mailchimp newsletter subscription summary
	newsletter: {
		requested: number; // Users who had "Sì" in newsletter column
		subscribed: number; // Successfully subscribed
		alreadySubscribed: number; // Already subscribed (resubscribed)
		failed: number; // Failed to subscribe
		errors: Array<{
			email: string;
			error: string;
		}>;
	};
}

/**
 * File parse result
 */
export interface FileParseResult {
	success: boolean;
	rows: AICSImportRow[];
	error?: string;
	rowCount: number;
	headerRow?: number; // Which row contained the headers (1-based)
}

/**
 * Info about a group of merged rows
 */
export interface MergedGroup {
	email: string;
	rows: number[]; // Row numbers that were merged
	conflicts: MergeConflict[];
}

/**
 * Preview state for UI
 */
export interface ImportPreview {
	totalRows: number; // Total rows in original file
	uniqueRowCount: number; // Rows after merging duplicates (by email)
	validCount: number;
	warningCount: number;
	errorCount: number;
	duplicateCount: number; // Number of rows that were merged (had duplicate emails)
	mergedGroups: MergedGroup[]; // Details of which rows were merged together
	rows: Array<{
		rowNumber: number;
		original: AICSImportRow;
		processed: ProcessedImportRow | null;
		validation: ValidationResult;
	}>;
}

/**
 * Column mapping for flexible imports
 * Maps file column names to expected field names
 */
export interface ColumnMapping {
	cognome: string;
	nome: string;
	email: string;
	dataNascita: string;
	sesso?: string;
	codiceFiscale?: string;
	provinciaNascita?: string;
	comuneNascita?: string;
	indirizzo?: string;
	cap?: string;
	provincia?: string;
	comune?: string;
	cellulare?: string;
	numeroTessera?: string;
	dataRilascioTessera?: string;
	newsletter?: string;
}

/**
 * Default AICS column mapping
 * Based on official AICS export format from scraper
 */
export const AICS_COLUMN_MAPPING: ColumnMapping = {
	cognome: 'Cognome',
	nome: 'Nome',
	email: 'E-mail',
	dataNascita: 'Data di nascita',
	sesso: 'Sesso',
	codiceFiscale: 'Codice fiscale',
	provinciaNascita: 'Provincia nascita',
	comuneNascita: 'Luogo di nascita',
	indirizzo: 'Indirizzo',
	cap: 'CAP',
	provincia: 'Provincia',
	comune: 'Comune',
	cellulare: 'Cellulare',
	numeroTessera: 'N° tessera',
	dataRilascioTessera: 'Data rilascio',
	newsletter: 'Iscritto alla newsletter'
};

/**
 * Alternative column names that should be recognized
 */
export const ALTERNATIVE_COLUMN_NAMES: Record<keyof ColumnMapping, string[]> = {
	cognome: ['Cognome', 'COGNOME', 'cognome', 'SURNAME', 'Surname'],
	nome: ['Nome', 'NOME', 'nome', 'NAME', 'Name', 'FIRST NAME'],
	email: ['E-mail', 'E-MAIL', 'e-mail', 'EMAIL', 'Email', 'email', 'MAIL'],
	dataNascita: [
		'Data di nascita',
		'DATA DI NASCITA',
		'DATA NASCITA',
		'Data nascita',
		'BIRTH DATE',
		'BIRTHDATE'
	],
	sesso: ['Sesso', 'SESSO', 'sesso', 'SEX', 'GENDER', 'M/F'],
	codiceFiscale: [
		'Codice fiscale',
		'CODICE FISCALE',
		'Codice Fiscale',
		'CF',
		'C.F.',
		'COD. FISCALE',
		'TAX CODE'
	],
	provinciaNascita: [
		'Provincia nascita',
		'PROVINCIA NASCITA',
		'PROV. NASCITA',
		'Prov. nascita',
		'PROV NASCITA'
	],
	comuneNascita: [
		'Luogo di nascita',
		'LUOGO DI NASCITA',
		'COMUNE DI NASCITA',
		'Comune di nascita',
		'COMUNE NASCITA',
		'Comune nascita',
		'BIRTH CITY'
	],
	indirizzo: ['Indirizzo', 'INDIRIZZO', 'indirizzo', 'ADDRESS', 'VIA'],
	cap: ['CAP', 'Cap', 'cap', 'POSTAL CODE', 'ZIP'],
	provincia: ['Provincia', 'PROVINCIA', 'PROV.', 'Prov.', 'PROV'],
	comune: ['Comune', 'COMUNE', 'comune', 'CITY', 'CITTA'],
	cellulare: ['Cellulare', 'CELLULARE', 'cellulare', 'CELL', 'PHONE', 'TELEFONO', 'TEL'],
	numeroTessera: ['N° tessera', 'N° TESSERA', 'NUMERO', 'Numero', 'N. TESSERA', 'TESSERA', 'CARD NUMBER'],
	dataRilascioTessera: ['Data rilascio', 'DATA RILASCIO', 'DATA', 'Data', 'ISSUE DATE'],
	newsletter: ['Iscritto alla newsletter', 'ISCRITTO ALLA NEWSLETTER', 'Iscritto newsletter', 'ISCRITTO NEWSLETTER']
};

/**
 * Error codes for import validation
 */
export enum ImportErrorCode {
	// File errors
	FILE_TOO_LARGE = 'FILE_TOO_LARGE',
	INVALID_FILE_TYPE = 'INVALID_FILE_TYPE',
	EMPTY_FILE = 'EMPTY_FILE',
	PARSE_ERROR = 'PARSE_ERROR',
	MISSING_HEADERS = 'MISSING_HEADERS',

	// Row validation errors
	MISSING_REQUIRED_FIELD = 'MISSING_REQUIRED_FIELD',
	INVALID_EMAIL = 'INVALID_EMAIL',
	DUPLICATE_EMAIL_IN_FILE = 'DUPLICATE_EMAIL_IN_FILE',
	EMAIL_EXISTS_IN_DB = 'EMAIL_EXISTS_IN_DB',
	INVALID_DATE = 'INVALID_DATE',
	FUTURE_BIRTH_DATE = 'FUTURE_BIRTH_DATE',
	AGE_TOO_YOUNG = 'AGE_TOO_YOUNG',
	INVALID_TAX_CODE = 'INVALID_TAX_CODE',
	TAX_CODE_REQUIRED = 'TAX_CODE_REQUIRED',
	TAX_CODE_BIRTHDATE_MISMATCH = 'TAX_CODE_BIRTHDATE_MISMATCH',
	INVALID_PROVINCE = 'INVALID_PROVINCE',
	INVALID_POSTAL_CODE = 'INVALID_POSTAL_CODE',

	// Warnings
	MISSING_TAX_CODE_FOREIGN = 'MISSING_TAX_CODE_FOREIGN',
	INVALID_PHONE = 'INVALID_PHONE',
	CITY_NOT_FOUND = 'CITY_NOT_FOUND',
	POSTAL_CODE_MISMATCH = 'POSTAL_CODE_MISMATCH'
}

/**
 * Italian error messages for import errors
 */
export const IMPORT_ERROR_MESSAGES: Record<ImportErrorCode, string> = {
	// File errors
	[ImportErrorCode.FILE_TOO_LARGE]: 'Il file è troppo grande (max 5MB)',
	[ImportErrorCode.INVALID_FILE_TYPE]: 'Formato file non supportato (usa .xlsx o .csv)',
	[ImportErrorCode.EMPTY_FILE]: 'Il file è vuoto',
	[ImportErrorCode.PARSE_ERROR]: 'Errore nella lettura del file',
	[ImportErrorCode.MISSING_HEADERS]: 'Intestazioni mancanti o non riconosciute',

	// Row validation errors
	[ImportErrorCode.MISSING_REQUIRED_FIELD]: 'Campo obbligatorio mancante',
	[ImportErrorCode.INVALID_EMAIL]: 'Email non valida',
	[ImportErrorCode.DUPLICATE_EMAIL_IN_FILE]: 'Email duplicata nel file',
	[ImportErrorCode.EMAIL_EXISTS_IN_DB]: 'Email già registrata nel sistema',
	[ImportErrorCode.INVALID_DATE]: 'Data non valida',
	[ImportErrorCode.FUTURE_BIRTH_DATE]: 'La data di nascita non può essere nel futuro',
	[ImportErrorCode.AGE_TOO_YOUNG]: 'Età minima non raggiunta (16 anni)',
	[ImportErrorCode.INVALID_TAX_CODE]: 'Codice fiscale non valido',
	[ImportErrorCode.TAX_CODE_REQUIRED]: 'Codice fiscale obbligatorio per cittadini italiani',
	[ImportErrorCode.TAX_CODE_BIRTHDATE_MISMATCH]:
		'La data di nascita non corrisponde al codice fiscale',
	[ImportErrorCode.INVALID_PROVINCE]: 'Provincia non valida',
	[ImportErrorCode.INVALID_POSTAL_CODE]: 'CAP non valido',

	// Warnings
	[ImportErrorCode.MISSING_TAX_CODE_FOREIGN]: 'Codice fiscale mancante (utente straniero)',
	[ImportErrorCode.INVALID_PHONE]: 'Numero di telefono non valido',
	[ImportErrorCode.CITY_NOT_FOUND]: 'Comune non trovato nel database ISTAT',
	[ImportErrorCode.POSTAL_CODE_MISMATCH]: 'CAP non corrispondente al comune'
};
