import { fail } from '@sveltejs/kit';
import type { Actions } from './$types';
import { emailSchema, formatZodErrors } from '$lib/server/utils/validation';
import { generateMagicLinkToken } from '$lib/server/auth/magic-link';
import { sendMagicLinkEmail } from '$lib/server/email/mailer';
import { APP_URL } from '$env/static/private';
import { checkRateLimit, getClientIP, RATE_LIMITS } from '$lib/server/utils/rate-limit';
import { authLogger } from '$lib/server/utils/logger';

export const actions = {
	default: async ({ request, locals }) => {
		// Get locale from request context
		const locale = (locals.locale === 'en' ? 'en' : 'it') as 'it' | 'en';

		// Rate limiting: prevent brute force magic link generation
		const clientIP = getClientIP(request);
		const rateLimitResponse = checkRateLimit(`magic-link:${clientIP}`, RATE_LIMITS.MAGIC_LINK);
		if (rateLimitResponse) {
			const errorMessage = locale === 'en'
				? 'Too many attempts. Please try again later.'
				: 'Troppi tentativi. Riprova più tardi.';
			return fail(429, {
				errors: { email: errorMessage },
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

			// Send magic link email via Resend
			authLogger.info({
				event: 'magic_link_sending',
				email: validation.data.email,
				locale
			}, 'Sending magic link email');
			await sendMagicLinkEmail(validation.data.email, token, APP_URL, locale);

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
			const errorMessage = locale === 'en'
				? 'Error sending email. Please try again later.'
				: 'Errore durante l\'invio dell\'email. Riprova più tardi.';
			return fail(500, {
				errors: { email: errorMessage },
				email: validation.data.email
			});
		}
	}
} satisfies Actions;
