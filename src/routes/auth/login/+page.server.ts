import { fail } from '@sveltejs/kit';
import type { Actions } from './$types';
import { emailSchema } from '$lib/server/utils/validation';
import { generateMagicLinkToken } from '$lib/server/auth/magic-link';
import { sendMagicLinkEmail } from '$lib/server/email/mailer';
import { APP_URL, SMTP_HOST } from '$env/static/private';

export const actions = {
	default: async ({ request }) => {
		const formData = await request.formData();
		const email = formData.get('email');

		// Validate email
		const validation = emailSchema.safeParse({ email });

		if (!validation.success) {
			const errors = validation.error.issues.reduce(
				(acc, issue) => {
					acc[issue.path[0]] = issue.message;
					return acc;
				},
				{} as Record<string, string>
			);
			return fail(400, { errors, email: email as string });
		}

		try {
			// Generate magic link token
			const token = generateMagicLinkToken(validation.data.email);

			// Debug SMTP_HOST
			console.log('🔍 DEBUG - SMTP_HOST:', JSON.stringify(SMTP_HOST));
			console.log('🔍 DEBUG - SMTP_HOST type:', typeof SMTP_HOST);

			// Check if SMTP is properly configured
			// If SMTP_HOST is empty or localhost, we're in development - just log the link
			const isDevMode = !SMTP_HOST || SMTP_HOST === '' || SMTP_HOST === 'localhost' || SMTP_HOST === '127.0.0.1';

			console.log('🔍 DEBUG - isDevMode:', isDevMode);

			if (isDevMode) {
				// Development mode: log magic link to console
				const magicLink = `${APP_URL}/auth/verify?token=${token}&email=${encodeURIComponent(validation.data.email)}`;
				console.log('\n🔗 Magic Link (Development Mode):');
				console.log('📧 Email:', validation.data.email);
				console.log('🔑 Link:', magicLink);
				console.log('\n');
			} else {
				// Production mode: send email via SMTP
				console.log('⚠️  Sending email via SMTP');
				await sendMagicLinkEmail(validation.data.email, token, APP_URL);
			}

			return {
				success: true,
				email: validation.data.email
			};
		} catch (error) {
			console.error('Error sending magic link:', error);
			return fail(500, {
				errors: { email: 'Errore durante l\'invio dell\'email. Riprova più tardi.' },
				email: validation.data.email
			});
		}
	}
} satisfies Actions;
