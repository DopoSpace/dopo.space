/**
 * Environment Variables Validation
 *
 * Validates all required environment variables at application startup
 * to fail fast if configuration is missing or invalid.
 */

import { z } from 'zod';
import {
	JWT_SECRET,
	DATABASE_URL,
	APP_URL,
	MAIN_DOMAIN,
	ADMIN_SUBDOMAIN,
	PAYPAL_CLIENT_ID,
	PAYPAL_CLIENT_SECRET,
	PAYPAL_MODE,
	PAYPAL_WEBHOOK_ID,
	MAILCHIMP_API_KEY,
	MAILCHIMP_SERVER_PREFIX,
	MAILCHIMP_AUDIENCE_ID
} from '$env/static/private';
import { env as dynamicEnv } from '$env/dynamic/private';

/**
 * Environment variables schema
 */
const envSchema = z.object({
	// JWT Configuration
	JWT_SECRET: z
		.string()
		.min(32, 'JWT_SECRET must be at least 32 characters for security')
		.refine(
			(val) => {
				// Blacklist of insecure default/placeholder values
				const blacklistedSecrets = [
					'your-super-secret-jwt-key-change-this-in-production',
					'your-secret-key-here-change-in-production' // From .env.example
				];
				return !blacklistedSecrets.includes(val);
			},
			'JWT_SECRET must not be a default/placeholder value. Please set a secure random string (e.g., openssl rand -base64 48).'
		),

	// Database
	DATABASE_URL: z.string().url('DATABASE_URL must be a valid URL'),

	// Application
	APP_URL: z.string().url('APP_URL must be a valid URL'),

	// Domain Configuration (for subdomain separation)
	MAIN_DOMAIN: z.string().min(1, 'MAIN_DOMAIN is required (e.g., dopo.space or dopo.local:5173)'),
	ADMIN_SUBDOMAIN: z.string().min(1, 'ADMIN_SUBDOMAIN is required (e.g., admin)'),

	// Email Configuration (Resend)
	RESEND_API_KEY: z.string().min(1, 'RESEND_API_KEY is required'),
	EMAIL_FROM: z.string().min(1, 'EMAIL_FROM is required (e.g., "Dopo Space <noreply@dopo.space>")'),

	// PayPal Configuration
	PAYPAL_CLIENT_ID: z.string().min(1, 'PAYPAL_CLIENT_ID is required'),
	PAYPAL_CLIENT_SECRET: z.string().min(1, 'PAYPAL_CLIENT_SECRET is required'),
	PAYPAL_MODE: z.enum(['sandbox', 'live'], {
		message: 'PAYPAL_MODE must be either "sandbox" or "live"'
	}),
	PAYPAL_WEBHOOK_ID: z.string().min(1, 'PAYPAL_WEBHOOK_ID is required'),

	// Mailchimp Configuration
	MAILCHIMP_API_KEY: z.string().min(1, 'MAILCHIMP_API_KEY is required'),
	MAILCHIMP_SERVER_PREFIX: z
		.string()
		.regex(/^[a-z]+\d+$/, 'MAILCHIMP_SERVER_PREFIX must be valid (e.g., us21)'),
	MAILCHIMP_AUDIENCE_ID: z.string().min(1, 'MAILCHIMP_AUDIENCE_ID is required')
});

/**
 * Validated environment variables
 * This will throw an error at startup if validation fails
 */
export const env = envSchema.parse({
	JWT_SECRET,
	DATABASE_URL,
	APP_URL,
	MAIN_DOMAIN,
	ADMIN_SUBDOMAIN,
	RESEND_API_KEY: dynamicEnv.RESEND_API_KEY,
	EMAIL_FROM: dynamicEnv.EMAIL_FROM,
	PAYPAL_CLIENT_ID,
	PAYPAL_CLIENT_SECRET,
	PAYPAL_MODE,
	PAYPAL_WEBHOOK_ID,
	MAILCHIMP_API_KEY,
	MAILCHIMP_SERVER_PREFIX,
	MAILCHIMP_AUDIENCE_ID
});

/**
 * Typed and validated environment access
 */
export function getJwtSecret(): string {
	return env.JWT_SECRET;
}

export function getDatabaseUrl(): string {
	return env.DATABASE_URL;
}

export function getAppUrl(): string {
	return env.APP_URL;
}

export function getMainDomain(): string {
	return env.MAIN_DOMAIN;
}

export function getAdminSubdomain(): string {
	return env.ADMIN_SUBDOMAIN;
}

export function getAdminDomain(): string {
	return `${env.ADMIN_SUBDOMAIN}.${env.MAIN_DOMAIN}`;
}

export function getResendApiKey(): string {
	return env.RESEND_API_KEY;
}

export function getEmailFrom(): string {
	return env.EMAIL_FROM;
}

/**
 * Google Places API key (optional, loaded from dynamic env)
 */
export function getGooglePlacesApiKey(): string | undefined {
	const key = dynamicEnv.GOOGLE_PLACES_API_KEY;
	return key && key.length > 0 ? key : undefined;
}
