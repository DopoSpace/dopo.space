/**
 * Email Service
 *
 * Handles sending transactional emails via SMTP (Nodemailer).
 */

import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import {
	SMTP_HOST,
	SMTP_PORT,
	SMTP_SECURE,
	SMTP_USER,
	SMTP_PASSWORD,
	EMAIL_FROM
} from '$env/static/private';
import { createLogger } from '$lib/server/utils/logger';

const logger = createLogger({ module: 'mailer' });

/**
 * Custom error class for email operations with error categorization
 */
export class EmailError extends Error {
	/** Whether this error is transient (can be retried) or permanent */
	public readonly isTransient: boolean;
	/** Original error cause */
	public readonly cause?: unknown;

	constructor(message: string, isTransient: boolean, cause?: unknown) {
		super(message);
		this.name = 'EmailError';
		this.isTransient = isTransient;
		this.cause = cause;
	}
}

/**
 * Categorize SMTP errors as transient (retryable) or permanent
 * @param error - The error to categorize
 * @returns true if the error is transient and can be retried
 */
function isTransientError(error: unknown): boolean {
	if (!(error instanceof Error)) return false;

	const errorMessage = error.message.toLowerCase();
	const errorCode = (error as NodeJS.ErrnoException).code?.toLowerCase() || '';

	// Transient errors - can be retried
	const transientCodes = [
		'econnreset', // Connection reset
		'econnrefused', // Connection refused (server down temporarily)
		'etimedout', // Connection timeout
		'esocket', // Socket error
		'enotfound', // DNS lookup failed (temporary)
		'enetunreach', // Network unreachable
		'ehostunreach' // Host unreachable
	];

	const transientMessages = [
		'connection timeout',
		'socket hang up',
		'temporary',
		'try again',
		'service unavailable',
		'too many connections',
		'rate limit'
	];

	// SMTP response codes in 4xx range are transient
	const smtp4xxPattern = /\b4\d{2}\b/;

	if (transientCodes.includes(errorCode)) return true;
	if (transientMessages.some((msg) => errorMessage.includes(msg))) return true;
	if (smtp4xxPattern.test(errorMessage)) return true;

	// Permanent errors - should NOT be retried
	// SMTP 5xx codes, auth failures, invalid addresses, etc.
	return false;
}

// Create transporter instance
let transporter: Transporter | null = null;

function getTransporter(): Transporter {
	if (!transporter) {
		transporter = nodemailer.createTransport({
			host: SMTP_HOST,
			port: parseInt(SMTP_PORT),
			secure: SMTP_SECURE === 'true',
			auth: SMTP_USER
				? {
						user: SMTP_USER,
						pass: SMTP_PASSWORD
					}
				: undefined
		});
	}
	return transporter;
}

/**
 * Send magic link email for authentication
 * @throws EmailError with isTransient flag indicating if retry is appropriate
 */
export async function sendMagicLinkEmail(email: string, token: string, url: string) {
	const transporter = getTransporter();

	const magicLink = `${url}/auth/verify?token=${token}&email=${encodeURIComponent(email)}`;

	try {
		await transporter.sendMail({
			from: EMAIL_FROM,
			to: email,
			subject: 'Login to Dopo Space',
			html: `
				<h1>Login to Dopo Space</h1>
				<p>Click the link below to login:</p>
				<a href="${magicLink}" style="display: inline-block; padding: 12px 24px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 8px;">Login</a>
				<p>Or copy this link:</p>
				<p>${magicLink}</p>
				<p>This link will expire in 15 minutes.</p>
			`,
			text: `Login to Dopo Space\n\nClick this link to login: ${magicLink}\n\nThis link will expire in 15 minutes.`
		});
	} catch (error) {
		const transient = isTransientError(error);
		logger.error(
			{ err: error, email, isTransient: transient },
			`Failed to send magic link email (${transient ? 'transient' : 'permanent'})`
		);
		throw new EmailError('Failed to send magic link email', transient, error);
	}
}

/**
 * Send payment confirmation email (S4 state)
 * @throws EmailError with isTransient flag indicating if retry is appropriate
 */
export async function sendPaymentConfirmationEmail(
	email: string,
	firstName: string,
	amount: number
) {
	const transporter = getTransporter();

	try {
		await transporter.sendMail({
			from: EMAIL_FROM,
			to: email,
			subject: 'Payment Confirmation - Dopo Space Membership',
			html: `
				<h1>Payment Confirmed!</h1>
				<p>Hi ${firstName},</p>
				<p>Your payment of €${(amount / 100).toFixed(2)} has been successfully processed.</p>
				<p>Your membership card number will be assigned shortly by our team.</p>
				<p>You can visit our office with this confirmation email to receive your membership card.</p>
				<br>
				<p>Thank you for joining Dopo Space!</p>
			`,
			text: `Payment Confirmed!\n\nHi ${firstName},\n\nYour payment of €${(amount / 100).toFixed(2)} has been successfully processed.\n\nYour membership card number will be assigned shortly by our team.\n\nYou can visit our office with this confirmation email to receive your membership card.\n\nThank you for joining Dopo Space!`
		});
	} catch (error) {
		const transient = isTransientError(error);
		logger.error(
			{ err: error, email, isTransient: transient },
			`Failed to send payment confirmation email (${transient ? 'transient' : 'permanent'})`
		);
		throw new EmailError('Failed to send payment confirmation email', transient, error);
	}
}

/**
 * Send membership number assignment email (S5 state)
 * @throws EmailError with isTransient flag indicating if retry is appropriate
 */
export async function sendMembershipNumberEmail(
	email: string,
	firstName: string,
	membershipNumber: string,
	endDate: Date
) {
	const transporter = getTransporter();

	try {
		await transporter.sendMail({
			from: EMAIL_FROM,
			to: email,
			subject: 'Your Membership Number - Dopo Space',
			html: `
				<h1>Welcome to Dopo Space!</h1>
				<p>Hi ${firstName},</p>
				<p>Your membership card number has been assigned:</p>
				<h2 style="color: #2563eb; font-size: 32px; margin: 20px 0;">${membershipNumber}</h2>
				<p>Your membership is valid until: <strong>${endDate.toLocaleDateString('it-IT')}</strong></p>
				<p>You can now access all Dopo Space facilities and services.</p>
				<br>
				<p>See you soon!</p>
			`,
			text: `Welcome to Dopo Space!\n\nHi ${firstName},\n\nYour membership card number has been assigned: ${membershipNumber}\n\nYour membership is valid until: ${endDate.toLocaleDateString('it-IT')}\n\nYou can now access all Dopo Space facilities and services.\n\nSee you soon!`
		});
	} catch (error) {
		const transient = isTransientError(error);
		logger.error(
			{ err: error, email, membershipNumber, isTransient: transient },
			`Failed to send membership number email (${transient ? 'transient' : 'permanent'})`
		);
		throw new EmailError('Failed to send membership number email', transient, error);
	}
}

/**
 * Generic email sending utility
 * @throws EmailError with isTransient flag indicating if retry is appropriate
 */
export async function sendEmail(to: string, subject: string, html: string, text?: string) {
	const transporter = getTransporter();

	try {
		await transporter.sendMail({
			from: EMAIL_FROM,
			to,
			subject,
			html,
			text: text || html.replace(/<[^>]*>/g, '') // Strip HTML tags for text version
		});
	} catch (error) {
		const transient = isTransientError(error);
		logger.error(
			{ err: error, to, subject, isTransient: transient },
			`Failed to send email (${transient ? 'transient' : 'permanent'})`
		);
		throw new EmailError('Failed to send email', transient, error);
	}
}
