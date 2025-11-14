import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import {
	verifyMagicLinkToken,
	authenticateUser,
	authenticateAdmin,
	generateSessionToken
} from '$lib/server/auth/magic-link';

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

	// Verify magic link token
	const payload = verifyMagicLinkToken(token);

	if (!payload || payload.email !== email) {
		return {
			error: 'Link non valido o scaduto. Richiedi un nuovo link di accesso.'
		};
	}

	let userId: string;
	let userEmail: string;
	let redirectPath: string;

	if (type === 'admin') {
		// Authenticate as admin (does NOT auto-create, must exist)
		try {
			const admin = await authenticateAdmin(email);
			userId = admin.id;
			userEmail = admin.email;
			redirectPath = '/admin/users';
		} catch (error) {
			return {
				error: 'Accesso negato. Account admin non trovato.'
			};
		}
	} else {
		// Authenticate as user (auto-creates if doesn't exist)
		const user = await authenticateUser(email);
		userId = user.id;
		userEmail = user.email;
		redirectPath = '/membership/subscription';
	}

	// Generate session token
	const sessionToken = generateSessionToken(userId, userEmail);

	// Set session cookie (HttpOnly, secure in production)
	cookies.set('session', sessionToken, {
		path: '/',
		httpOnly: true,
		secure: process.env.NODE_ENV === 'production',
		sameSite: 'lax',
		maxAge: 60 * 60 * 24 * 7 // 7 days
	});

	// Redirect to appropriate page
	throw redirect(303, redirectPath);
};
