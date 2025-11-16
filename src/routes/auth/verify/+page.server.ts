import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import {
	verifyMagicLinkToken,
	authenticateUser,
	authenticateAdmin,
	generateSessionToken
} from '$lib/server/auth/magic-link';
import { SESSION_COOKIE_NAME, getCookieOptions } from '$lib/server/config/constants';

export const load: PageServerLoad = async ({ url, cookies }) => {
	const token = url.searchParams.get('token');
	const email = url.searchParams.get('email');
	const type = url.searchParams.get('type'); // 'admin' or null (default: user)

	// Validate token and email presence
	if (!token || !email) {
		return {
			error: 'Link non valido. Token o email mancanti.'
		};
	}

	// Normalize email for comparison
	const normalizedEmail = email.toLowerCase().trim();

	// Verify magic link token (one-time use enforcement)
	const payload = await verifyMagicLinkToken(token);

	if (!payload || payload.email !== normalizedEmail) {
		return {
			error: 'Link non valido o scaduto. Richiedi un nuovo link di accesso.'
		};
	}

	let userId: string;
	let userEmail: string;
	let redirectPath: string;
	let role: 'user' | 'admin';

	if (type === 'admin') {
		// Authenticate as admin (does NOT auto-create, must exist)
		try {
			const admin = await authenticateAdmin(normalizedEmail);
			userId = admin.id;
			userEmail = admin.email;
			redirectPath = '/admin/users';
			role = 'admin';
		} catch (error) {
			return {
				error: 'Accesso negato. Account admin non trovato.'
			};
		}
	} else {
		// Authenticate as user (auto-creates if doesn't exist)
		const user = await authenticateUser(normalizedEmail);
		userId = user.id;
		userEmail = user.email;
		redirectPath = '/membership/subscription';
		role = 'user';
	}

	// Generate session token with appropriate role
	const sessionToken = generateSessionToken(userId, userEmail, role);

	// Set session cookie (HttpOnly, secure in production)
	cookies.set(SESSION_COOKIE_NAME, sessionToken, getCookieOptions());

	// Redirect to appropriate page
	throw redirect(303, redirectPath);
};
