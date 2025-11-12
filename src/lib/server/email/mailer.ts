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
 */
export async function sendMagicLinkEmail(email: string, token: string, url: string) {
	const transporter = getTransporter();

	const magicLink = `${url}/auth/verify?token=${token}&email=${encodeURIComponent(email)}`;

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
}

/**
 * Send payment confirmation email (S4 state)
 */
export async function sendPaymentConfirmationEmail(
	email: string,
	firstName: string,
	amount: number
) {
	const transporter = getTransporter();

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
}

/**
 * Send membership number assignment email (S5 state)
 */
export async function sendMembershipNumberEmail(
	email: string,
	firstName: string,
	membershipNumber: string,
	endDate: Date
) {
	const transporter = getTransporter();

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
}

/**
 * Generic email sending utility
 */
export async function sendEmail(to: string, subject: string, html: string, text?: string) {
	const transporter = getTransporter();

	await transporter.sendMail({
		from: EMAIL_FROM,
		to,
		subject,
		html,
		text: text || html.replace(/<[^>]*>/g, '') // Strip HTML tags for text version
	});
}
