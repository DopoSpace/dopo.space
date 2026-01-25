import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import {
	verifyMagicLinkToken,
	authenticateUser,
	generateSessionToken
} from '$lib/server/auth/magic-link';
import { USER_SESSION_COOKIE_NAME, getUserCookieOptions } from '$lib/server/config/constants';
import { authLogger } from '$lib/server/utils/logger';
import { prisma } from '$lib/server/db/prisma';

export const load: PageServerLoad = async ({ url, cookies, locals }) => {
	const token = url.searchParams.get('token');
	const email = url.searchParams.get('email');

	// Validate token and email presence
	if (!token || !email) {
		authLogger.warn({
			event: 'magic_link_verification_failed',
			reason: 'missing_params',
			hasToken: !!token,
			hasEmail: !!email
		}, 'Magic link verification failed - missing parameters');
		return {
			error: 'Link non valido. Token o email mancanti.'
		};
	}

	// Normalize email for comparison
	const normalizedEmail = email.toLowerCase().trim();

	// Verify magic link token (one-time use enforcement)
	const payload = await verifyMagicLinkToken(token);

	if (!payload) {
		authLogger.warn({
			event: 'magic_link_verification_failed',
			email: normalizedEmail,
			reason: 'invalid_or_expired_token',
			tokenPrefix: token.substring(0, 10) + '...'
		}, 'Magic link verification failed - invalid or expired token');
		return {
			error: 'Link non valido o scaduto. Richiedi un nuovo link di accesso.'
		};
	}

	if (payload.email !== normalizedEmail) {
		authLogger.warn({
			event: 'magic_link_verification_failed',
			expectedEmail: normalizedEmail,
			tokenEmail: payload.email,
			reason: 'email_mismatch'
		}, 'Magic link verification failed - email mismatch');
		return {
			error: 'Link non valido o scaduto. Richiedi un nuovo link di accesso.'
		};
	}

	// Authenticate as user (auto-creates if doesn't exist)
	// Note: Admin login uses password-based auth on admin subdomain
	let user;
	try {
		user = await authenticateUser(normalizedEmail);

		// Save the user's preferred locale for future emails (e.g., payment confirmation)
		const locale = locals.locale === 'en' ? 'en' : 'it';
		await prisma.user.update({
			where: { id: user.id },
			data: { preferredLocale: locale }
		});
	} catch (error) {
		authLogger.error({
			event: 'magic_link_authentication_failed',
			email: normalizedEmail,
			err: error
		}, 'Failed to authenticate user after magic link verification');
		return {
			error: 'Si è verificato un errore durante l\'accesso. Riprova più tardi.'
		};
	}

	// Generate session token with user role
	const sessionToken = generateSessionToken(user.id, user.email, 'user');

	// Set user session cookie (HttpOnly, secure in production)
	cookies.set(USER_SESSION_COOKIE_NAME, sessionToken, getUserCookieOptions());

	// Redirect to membership dashboard
	throw redirect(303, '/membership/subscription');
};
