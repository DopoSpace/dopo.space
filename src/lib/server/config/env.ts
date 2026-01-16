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
	SMTP_HOST,
	SMTP_PORT,
	SMTP_USER,
	SMTP_PASSWORD,
	SMTP_SECURE,
	EMAIL_FROM,
	PAYPAL_CLIENT_ID,
	PAYPAL_CLIENT_SECRET,
	PAYPAL_MODE,
	PAYPAL_WEBHOOK_ID
} from '$env/static/private';

/**
 * Environment variables schema
 */
const envSchema = z.object({
	// JWT Configuration
	JWT_SECRET: z
		.string()
		.min(32, 'JWT_SECRET must be at least 32 characters for security')
		.refine(
			(val) => val !== 'your-super-secret-jwt-key-change-this-in-production',
			'JWT_SECRET must not be the default value. Please set a secure random string.'
		),

	// Database
	DATABASE_URL: z.string().url('DATABASE_URL must be a valid URL'),

	// Application
	APP_URL: z.string().url('APP_URL must be a valid URL'),

	// Domain Configuration (for subdomain separation)
	MAIN_DOMAIN: z.string().min(1, 'MAIN_DOMAIN is required (e.g., dopo.space or dopo.local:5173)'),
	ADMIN_SUBDOMAIN: z.string().min(1, 'ADMIN_SUBDOMAIN is required (e.g., admin)'),

	// SMTP Configuration (optional in development)
	SMTP_HOST: z.string().optional(),
	SMTP_PORT: z
		.string()
		.optional()
		.refine(
			(val) => {
				if (!val) return true; // optional
				const port = parseInt(val, 10);
				return !isNaN(port) && port > 0 && port <= 65535;
			},
			'SMTP_PORT must be a valid port number between 1 and 65535'
		),
	SMTP_USER: z.string().optional(),
	SMTP_PASSWORD: z.string().optional(),
	SMTP_SECURE: z.enum(['true', 'false', '']).optional(),
	EMAIL_FROM: z.string().email('EMAIL_FROM must be a valid email address').optional(),

	// PayPal Configuration
	PAYPAL_CLIENT_ID: z.string().min(1, 'PAYPAL_CLIENT_ID is required'),
	PAYPAL_CLIENT_SECRET: z.string().min(1, 'PAYPAL_CLIENT_SECRET is required'),
	PAYPAL_MODE: z.enum(['sandbox', 'live'], {
		message: 'PAYPAL_MODE must be either "sandbox" or "live"'
	}),
	PAYPAL_WEBHOOK_ID: z.string().min(1, 'PAYPAL_WEBHOOK_ID is required')
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
	SMTP_HOST,
	SMTP_PORT,
	SMTP_USER,
	SMTP_PASSWORD,
	SMTP_SECURE,
	EMAIL_FROM,
	PAYPAL_CLIENT_ID,
	PAYPAL_CLIENT_SECRET,
	PAYPAL_MODE,
	PAYPAL_WEBHOOK_ID
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

export function getSmtpPort(): number {
	if (!env.SMTP_PORT) {
		return 587; // Default SMTP port
	}
	return parseInt(env.SMTP_PORT, 10);
}

export function getSmtpSecure(): boolean {
	return env.SMTP_SECURE === 'true';
}

export function getEmailFrom(): string {
	return env.EMAIL_FROM || 'noreply@dopo.space';
}

/**
 * Check if SMTP is configured
 */
export function isSmtpConfigured(): boolean {
	return !!(env.SMTP_HOST && env.SMTP_PORT && env.SMTP_USER && env.SMTP_PASSWORD && env.EMAIL_FROM);
}
