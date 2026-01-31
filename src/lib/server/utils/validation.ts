/**
 * Validation Schemas
 *
 * Zod schemas for validating user input across the application.
 */

import { z } from 'zod';
import { validateTaxCode, validateTaxCodeConsistency } from './tax-code';
import { isValidAge } from '$lib/utils/date';
import { isValidComuneAICS, getOfficialComuneName } from '$lib/server/data/aics-comuni';
import { createLogger } from '$lib/server/utils/logger';

const logger = createLogger({ module: 'validation' });

/**
 * Tax code format regex (supports omocodia)
 * Standard: RSSMRA85M10H501S
 * Omocodia letters can appear at digit positions: LMNPQRSTUV
 */
const TAX_CODE_REGEX = /^[A-Z]{6}[0-9LMNPQRSTUV]{2}[A-Z][0-9LMNPQRSTUV]{2}[A-Z][0-9LMNPQRSTUV]{3}[A-Z]$/i;

/**
 * User profile validation schema (base fields without cross-validation)
 */
const userProfileBaseSchema = z.object({
	firstName: z.string().min(2, 'Il nome deve contenere almeno 2 caratteri').max(50),
	lastName: z.string().min(2, 'Il cognome deve contenere almeno 2 caratteri').max(50),
	birthDate: z.coerce.date().refine(isValidAge, 'Devi avere almeno 16 anni per iscriverti. Il tesseramento dei minori non è al momento supportato.'),

	// Nationality: IT for Italian, country code for foreigners
	nationality: z.string().length(2, 'Seleziona la nazionalità').toUpperCase(),

	// Birth place information
	birthProvince: z.string().length(2, 'La provincia deve essere di 2 lettere').toUpperCase(),
	birthCity: z.string().min(2, 'Inserisci il comune di nascita').max(100),

	// For foreigners with Italian tax code
	hasForeignTaxCode: z.coerce.boolean().default(false),

	// Gender (required for foreigners without tax code)
	gender: z.enum(['M', 'F'], { message: 'Seleziona il sesso' }).optional().or(z.literal('')),

	// Tax code (optional, validated based on nationality)
	taxCode: z
		.string()
		.regex(TAX_CODE_REGEX, 'Formato codice fiscale non valido')
		.optional()
		.or(z.literal('')),

	// Residence country (ISO 2-letter code)
	residenceCountry: z.string().length(2, 'Seleziona il paese di residenza').toUpperCase().default('IT'),

	// Residence - all fields are optional
	address: z.string().max(200).optional().or(z.literal('')),
	city: z.string().max(100).optional().or(z.literal('')),
	postalCode: z.string().max(20).optional().or(z.literal('')),
	province: z.string().regex(/^[A-Z]{2}$/i, 'La provincia deve essere di 2 lettere').optional().or(z.literal('')),

	// Contact (phone is optional, format: +[prefix][number])
	phone: z
		.string()
		.regex(/^\+\d{7,19}$/, 'Formato numero di telefono non valido')
		.optional()
		.or(z.literal('')),

	// Document info (optional)
	documentType: z.string().optional().or(z.literal('')),
	documentNumber: z.string().optional().or(z.literal('')),

	// Consents
	privacyConsent: z.literal(true, {
		message: 'Devi accettare la privacy policy'
	}),
	dataConsent: z.literal(true, {
		message: 'Devi acconsentire al trattamento dei dati'
	})
});

/**
 * User profile validation schema with cross-field validation
 *
 * Rules:
 * - If Italian (nationality = IT): taxCode is required
 * - If foreign without hasForeignTaxCode: taxCode should be empty
 * - If taxCode provided: validate checksum and consistency with birthDate
 * - If Italian residence (residenceCountry = IT): postalCode must be 5 digits
 * - If foreign residence (residenceCountry != IT): province must be "EE"
 */
export const userProfileSchema = userProfileBaseSchema.superRefine((data, ctx) => {
	const isItalian = data.nationality === 'IT';
	const isForeigner = data.nationality === 'XX';
	const hasTaxCode = data.taxCode && data.taxCode.length > 0;
	const isItalianResidence = data.residenceCountry === 'IT';

	// Foreigners who claim to have an Italian tax code must provide it
	if (isForeigner && data.hasForeignTaxCode && !hasTaxCode) {
		ctx.addIssue({
			code: z.ZodIssueCode.custom,
			message: 'Inserisci il Codice Fiscale oppure deseleziona "Ho un Codice Fiscale italiano"',
			path: ['taxCode']
		});
		return;
	}

	// Foreigners without tax code must provide gender (since it cannot be derived from CF)
	if (isForeigner && !hasTaxCode && (!data.gender || data.gender.length === 0)) {
		ctx.addIssue({
			code: z.ZodIssueCode.custom,
			message: 'Il sesso è obbligatorio quando non hai un Codice Fiscale',
			path: ['gender']
		});
	}

	// Italian citizens must have a tax code
	if (isItalian && !hasTaxCode) {
		ctx.addIssue({
			code: z.ZodIssueCode.custom,
			message: 'Il codice fiscale è obbligatorio per i cittadini italiani',
			path: ['taxCode']
		});
		return;
	}

	// If tax code is provided, validate it
	if (hasTaxCode && data.taxCode) {
		const result = validateTaxCode(data.taxCode);

		if (!result.valid) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: result.error || 'Codice fiscale non valido',
				path: ['taxCode']
			});
			return;
		}

		// Validate consistency with birth date
		if (!validateTaxCodeConsistency(data.taxCode, data.birthDate)) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: 'La data di nascita non corrisponde al codice fiscale',
				path: ['taxCode']
			});
		}
	}

	// Residence validation (only if postal code or province is provided)
	const hasPostalCode = data.postalCode && data.postalCode.length > 0;
	const hasProvince = data.province && data.province.length > 0;

	if (isItalianResidence) {
		// Italian residence: if postalCode provided, must be exactly 5 digits
		if (hasPostalCode && !/^\d{5}$/.test(data.postalCode!)) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: 'Il CAP deve essere di 5 cifre',
				path: ['postalCode']
			});
		}
	} else {
		// Foreign residence: if province provided, must be "EE"
		if (hasProvince && data.province!.toUpperCase() !== 'EE') {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: 'Per residenza estera la provincia deve essere "EE"',
				path: ['province']
			});
		}
		// Foreign residence: if postalCode provided, must be "00000"
		if (hasPostalCode && data.postalCode! !== '00000') {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: 'Per residenza estera il CAP deve essere "00000"',
				path: ['postalCode']
			});
		}
	}
});

/**
 * Email validation schema
 */
export const emailSchema = z.object({
	email: z.string().email('Invalid email address')
});

/**
 * Phone validation schema
 */
export const phoneSchema = z.object({
	phone: z.string().regex(/^\+?[1-9]\d{1,14}$/, 'Invalid phone number format').optional()
});

/**
 * Newsletter subscription schema
 */
export const newsletterSchema = z.object({
	subscribed: z.boolean()
});

/**
 * Admin membership number assignment schema (single user)
 */
export const assignMembershipNumberSchema = z.object({
	userIds: z.array(z.string().cuid('ID utente non valido')),
	startNumber: z.number().int().positive().optional(),
	specificNumbers: z.record(z.string().cuid(), z.string()).optional() // userId -> membershipNumber
});

/**
 * Batch card assignment schema
 * Used for assigning membership numbers to multiple users at once
 */
export const batchAssignCardsSchema = z.object({
	prefix: z.string().max(20, 'Il prefisso non può superare 20 caratteri').optional().default(''),
	startNumber: z.string().min(1, 'Inserisci il numero iniziale').max(10, 'Numero troppo lungo'),
	endNumber: z.string().min(1, 'Inserisci il numero finale').max(10, 'Numero troppo lungo'),
	userIds: z.array(z.string().cuid('ID utente non valido')).min(1, 'Seleziona almeno un utente')
}).refine(
	(data) => {
		const start = parseInt(data.startNumber, 10);
		const end = parseInt(data.endNumber, 10);
		return !isNaN(start) && !isNaN(end) && start <= end;
	},
	{
		message: 'Il numero iniziale deve essere minore o uguale al numero finale',
		path: ['endNumber']
	}
);

/**
 * Simple subscription form schema (first name and last name only)
 * Used for the initial subscription step before full profile completion
 */
export const simpleSubscriptionSchema = z.object({
	firstName: z.string().min(2, 'Il nome deve contenere almeno 2 caratteri').max(50, 'Il nome è troppo lungo'),
	lastName: z.string().min(2, 'Il cognome deve contenere almeno 2 caratteri').max(50, 'Il cognome è troppo lungo')
});

/**
 * Card number range schema
 * Used for adding new card number ranges in admin
 */
export const addCardRangeSchema = z
	.object({
		startNumber: z.coerce
			.number()
			.int('Deve essere un numero intero')
			.positive('Deve essere positivo'),
		endNumber: z.coerce
			.number()
			.int('Deve essere un numero intero')
			.positive('Deve essere positivo')
	})
	.refine((data) => data.startNumber <= data.endNumber, {
		message: 'Il numero iniziale deve essere minore o uguale al numero finale',
		path: ['endNumber']
	})
	.refine((data) => data.endNumber - data.startNumber + 1 <= 1000, {
		message: 'Il range non può contenere più di 1000 numeri',
		path: ['endNumber']
	});

/**
 * Auto-assign cards schema
 * Used for automatic card assignment from configured ranges
 */
export const autoAssignCardsSchema = z.object({
	userIds: z
		.array(z.string().cuid('ID utente non valido'))
		.min(1, 'Seleziona almeno un utente')
});

/**
 * Assign cards schema with discriminated union for different modes
 * - auto: automatic assignment from pool
 * - range: specific range of numbers
 * - single: single specific number
 */
export const assignCardsSchema = z.discriminatedUnion('mode', [
	z.object({
		mode: z.literal('auto'),
		userIds: z.array(z.string().cuid('ID utente non valido')).min(1, 'Seleziona almeno un utente')
	}),
	z.object({
		mode: z.literal('range'),
		userIds: z.array(z.string().cuid('ID utente non valido')).min(1, 'Seleziona almeno un utente'),
		startNumber: z.string().min(1, 'Inserisci il numero iniziale'),
		endNumber: z.string().min(1, 'Inserisci il numero finale')
	}).refine(
		(data) => {
			const start = parseInt(data.startNumber, 10);
			const end = parseInt(data.endNumber, 10);
			return !isNaN(start) && !isNaN(end) && start <= end;
		},
		{ message: 'Il numero iniziale deve essere ≤ al numero finale', path: ['endNumber'] }
	),
	z.object({
		mode: z.literal('single'),
		userIds: z.array(z.string().cuid('ID utente non valido')).length(1, 'Seleziona esattamente un utente'),
		membershipNumber: z.string().min(1, 'Inserisci il numero tessera')
	})
]);

/**
 * Helper function to format Zod validation errors
 */
export function formatZodErrors(errors: z.ZodError): Record<string, string> {
	const result: Record<string, string> = {};
	for (const issue of errors.issues) {
		result[issue.path.join('.')] = issue.message;
	}
	return result;
}

/**
 * Soft validation for comune against AICS database
 *
 * This is a logging-only function that warns when a comune is not found
 * in the official AICS database. It does NOT block form submission.
 * The export function will auto-correct comune names when generating AICS exports.
 *
 * @param city - The comune name to validate
 * @param province - The 2-letter province code
 * @param context - Optional context for logging (e.g., user email)
 * @returns Object with isValid flag and suggested official name if found
 */
export function validateComuneForLogging(
	city: string,
	province: string,
	context?: { email?: string; userId?: string }
): { isValid: boolean; officialName: string | null } {
	// Skip validation for foreign provinces
	if (!city || !province || province.toUpperCase() === 'EE') {
		return { isValid: true, officialName: null };
	}

	const isValid = isValidComuneAICS(city, province);
	const officialName = getOfficialComuneName(city, province);

	if (!isValid) {
		logger.warn(
			{
				city,
				province,
				officialName,
				...context
			},
			'Comune not found in AICS database - will be auto-corrected on export'
		);
	} else if (officialName && officialName !== city) {
		logger.info(
			{
				city,
				province,
				officialName,
				...context
			},
			'Comune name will be normalized on export'
		);
	}

	return { isValid, officialName };
}
