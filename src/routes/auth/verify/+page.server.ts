import { redirect, fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import {
	verifyMagicLinkToken,
	peekMagicLinkToken,
	authenticateUser,
	generateSessionToken
} from '$lib/server/auth/magic-link';
import { USER_SESSION_COOKIE_NAME, getUserCookieOptions } from '$lib/server/config/constants';
import { authLogger } from '$lib/server/utils/logger';
import { prisma } from '$lib/server/db/prisma';

export const load: PageServerLoad = async ({ url }) => {
	const token = url.searchParams.get('token');

	if (!token) {
		authLogger.warn({ event: 'magic_link_peek_failed', reason: 'missing_token' },
			'Magic link verification failed - missing token');
		return { error: 'Link non valido. Token mancante.' };
	}

	// Peek at token to check validity without consuming it.
	// This prevents email client link previews from consuming one-time tokens,
	// since verification only happens on POST (which previews don't trigger).
	const peek = peekMagicLinkToken(token);

	if (!peek) {
		authLogger.warn({ event: 'magic_link_peek_failed', reason: 'invalid_or_expired',
			tokenPrefix: `${token.substring(0, 10)}...` },
			'Magic link verification failed - invalid or expired token');
		return { error: 'Link non valido o scaduto. Richiedi un nuovo link di accesso.' };
	}

	return { token };
};

export const actions = {
	default: async ({ request, cookies, locals }) => {
		const formData = await request.formData();
		const token = formData.get('token') as string;

		if (!token) {
			return fail(400, {
				error: 'Token mancante.'
			});
		}

		// Full verification: validates JWT and marks token as used (one-time use)
		const payload = await verifyMagicLinkToken(token);

		if (!payload) {
			authLogger.warn({ event: 'magic_link_verify_failed', reason: 'invalid_or_expired',
				tokenPrefix: `${token.substring(0, 10)}...` },
				'Magic link verification failed during confirmation');
			return fail(400, { error: 'Link non valido o scaduto. Richiedi un nuovo link di accesso.' });
		}

		// Authenticate user (auto-creates if first login)
		let user;
		try {
			user = await authenticateUser(payload.email);

			// Save the user's preferred locale for future emails
			const locale = locals.locale === 'en' ? 'en' : 'it';
			await prisma.user.update({
				where: { id: user.id },
				data: { preferredLocale: locale }
			});
		} catch (error) {
			authLogger.error({
				event: 'magic_link_authentication_failed',
				email: payload.email,
				err: error
			}, 'Failed to authenticate user after magic link verification');
			return fail(500, {
				error: 'Si è verificato un errore durante l\'accesso. Riprova più tardi.'
			});
		}

		// Generate session token and set cookie
		const sessionToken = generateSessionToken(user.id, user.email, 'user');
		cookies.set(USER_SESSION_COOKIE_NAME, sessionToken, getUserCookieOptions());

		throw redirect(303, '/membership/subscription');
	}
} satisfies Actions;
