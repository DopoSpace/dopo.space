import { fail } from '@sveltejs/kit';
import type { Actions } from './$types';
import { emailSchema, formatZodErrors } from '$lib/server/utils/validation';
import { generateMagicLinkToken } from '$lib/server/auth/magic-link';
import { sendMagicLinkEmail } from '$lib/server/email/mailer';
import { APP_URL, SMTP_HOST } from '$env/static/private';
import { checkRateLimit, getClientIP, RATE_LIMITS } from '$lib/server/utils/rate-limit';
import { authLogger } from '$lib/server/utils/logger';

export const actions = {
	default: async ({ request }) => {
		// Rate limiting: prevent brute force magic link generation
		const clientIP = getClientIP(request);
		const rateLimitResponse = checkRateLimit(`magic-link:${clientIP}`, RATE_LIMITS.MAGIC_LINK);
		if (rateLimitResponse) {
			return fail(429, {
				errors: { email: 'Troppi tentativi. Riprova più tardi.' },
				email: ''
			});
		}

		const formData = await request.formData();
		const email = formData.get('email');

		// Validate email
		const validation = emailSchema.safeParse({ email });

		if (!validation.success) {
			const errors = formatZodErrors(validation.error);
			return fail(400, { errors, email: email as string });
		}

		try {
			// Generate magic link token
			const token = generateMagicLinkToken(validation.data.email);

			// Check if SMTP is properly configured
			// If SMTP_HOST is empty or localhost, we're in development - just log the link
			const isDevMode = !SMTP_HOST || SMTP_HOST === '' || SMTP_HOST === 'localhost' || SMTP_HOST === '127.0.0.1';

			if (isDevMode) {
				// Development mode: log magic link to console
				const magicLink = `${APP_URL}/auth/verify?token=${token}&email=${encodeURIComponent(validation.data.email)}`;
				authLogger.info({
					event: 'magic_link_generated',
					email: validation.data.email,
					magicLink,
					mode: 'development'
				}, 'Magic link generated (dev mode)');
			} else {
				// Production mode: send email via SMTP
				authLogger.info({
					event: 'magic_link_sent',
					email: validation.data.email,
					mode: 'production'
				}, 'Sending magic link via SMTP');
				await sendMagicLinkEmail(validation.data.email, token, APP_URL);
			}

			return {
				success: true,
				email: validation.data.email
			};
		} catch (error) {
			authLogger.error({
				event: 'magic_link_error',
				email: validation.data.email,
				error: error instanceof Error ? error.message : 'Unknown error'
			}, 'Error sending magic link');
			return fail(500, {
				errors: { email: 'Errore durante l\'invio dell\'email. Riprova più tardi.' },
				email: validation.data.email
			});
		}
	}
} satisfies Actions;
