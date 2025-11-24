/**
 * Validation Schemas
 *
 * Zod schemas for validating user input across the application.
 */

import { z } from 'zod';

/**
 * User profile validation schema
 */
export const userProfileSchema = z.object({
	firstName: z.string().min(2, 'First name must be at least 2 characters').max(50),
	lastName: z.string().min(2, 'Last name must be at least 2 characters').max(50),
	birthDate: z.coerce.date().refine((date) => {
		const age = new Date().getFullYear() - date.getFullYear();
		return age >= 16 && age <= 120;
	}, 'You must be at least 16 years old'),
	taxCode: z.string().regex(/^[A-Z]{6}\d{2}[A-Z]\d{2}[A-Z]\d{3}[A-Z]$/i, 'Invalid tax code format').optional().or(z.literal('')),
	address: z.string().min(5, 'Address must be at least 5 characters').max(200),
	city: z.string().min(2, 'City must be at least 2 characters').max(100),
	postalCode: z.string().regex(/^\d{5}$/, 'Postal code must be 5 digits'),
	province: z.string().regex(/^[A-Z]{2}$/i, 'Province must be 2 letters (e.g., MI, RM)'),
	documentType: z.string().optional().or(z.literal('')),
	documentNumber: z.string().optional().or(z.literal('')),
	// z.literal(true) already ensures the value must be true
	privacyConsent: z.literal(true, {
		message: 'You must accept the privacy policy'
	}),
	dataConsent: z.literal(true, {
		message: 'You must consent to data processing'
	})
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
	userIds: z.array(z.string()),
	startNumber: z.number().int().positive().optional(),
	specificNumbers: z.record(z.string(), z.string()).optional() // userId -> membershipNumber
});

/**
 * Batch card assignment schema
 * Used for assigning membership numbers to multiple users at once
 */
export const batchAssignCardsSchema = z.object({
	prefix: z.string().max(20, 'Il prefisso non può superare 20 caratteri').optional().default(''),
	startNumber: z.string().min(1, 'Inserisci il numero iniziale').max(10, 'Numero troppo lungo'),
	endNumber: z.string().min(1, 'Inserisci il numero finale').max(10, 'Numero troppo lungo'),
	userIds: z.array(z.string()).min(1, 'Seleziona almeno un utente')
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
 * Helper function to format Zod validation errors
 */
export function formatZodErrors(errors: z.ZodError): Record<string, string> {
	return errors.issues.reduce(
		(acc: Record<string, string>, error) => {
			const path = error.path.join('.');
			acc[path] = error.message;
			return acc;
		},
		{} as Record<string, string>
	);
}
