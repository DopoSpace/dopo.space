/**
 * Validation Schemas
 *
 * Zod schemas for validating user input across the application.
 */

import { z } from 'zod';
import { validateTaxCode, validateTaxCodeConsistency } from './tax-code';

/**
 * Age validation refine function
 */
const validateAge = (date: Date) => {
	const today = new Date();
	let age = today.getFullYear() - date.getFullYear();
	const monthDiff = today.getMonth() - date.getMonth();
	if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < date.getDate())) {
		age--;
	}
	return age >= 16 && age <= 120;
};

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
	birthDate: z.coerce.date().refine(validateAge, 'Devi avere almeno 16 anni'),

	// Nationality: IT for Italian, country code for foreigners
	nationality: z.string().length(2, 'Seleziona la nazionalità').toUpperCase(),

	// Birth place information
	birthProvince: z.string().length(2, 'La provincia deve essere di 2 lettere').toUpperCase(),
	birthCity: z.string().min(2, 'Inserisci il comune di nascita').max(100),

	// For foreigners with Italian tax code
	hasForeignTaxCode: z.coerce.boolean().default(false),

	// Tax code (optional, validated based on nationality)
	taxCode: z
		.string()
		.regex(TAX_CODE_REGEX, 'Formato codice fiscale non valido')
		.optional()
		.or(z.literal('')),

	// Residence
	address: z.string().min(5, "L'indirizzo deve contenere almeno 5 caratteri").max(200),
	city: z.string().min(2, 'Il comune deve contenere almeno 2 caratteri').max(100),
	postalCode: z.string().regex(/^\d{5}$/, 'Il CAP deve essere di 5 cifre'),
	province: z.string().regex(/^[A-Z]{2}$/i, 'La provincia deve essere di 2 lettere'),

	// Contact (phone is optional)
	phone: z
		.string()
		.regex(/^\+?[0-9]{6,15}$/, 'Formato numero di telefono non valido')
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
 */
export const userProfileSchema = userProfileBaseSchema.superRefine((data, ctx) => {
	const isItalian = data.nationality === 'IT';
	const hasTaxCode = data.taxCode && data.taxCode.length > 0;

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
	userIds: z.array(z.string().uuid('ID utente non valido')),
	startNumber: z.number().int().positive().optional(),
	specificNumbers: z.record(z.string().uuid(), z.string()).optional() // userId -> membershipNumber
});

/**
 * Batch card assignment schema
 * Used for assigning membership numbers to multiple users at once
 */
export const batchAssignCardsSchema = z.object({
	prefix: z.string().max(20, 'Il prefisso non può superare 20 caratteri').optional().default(''),
	startNumber: z.string().min(1, 'Inserisci il numero iniziale').max(10, 'Numero troppo lungo'),
	endNumber: z.string().min(1, 'Inserisci il numero finale').max(10, 'Numero troppo lungo'),
	userIds: z.array(z.string().uuid('ID utente non valido')).min(1, 'Seleziona almeno un utente')
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
		.array(z.string().uuid('ID utente non valido'))
		.min(1, 'Seleziona almeno un utente')
});

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
