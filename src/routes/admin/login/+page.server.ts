import { fail, redirect } from '@sveltejs/kit';
import type { Actions } from './$types';
import { emailSchema, formatZodErrors } from '$lib/server/utils/validation';
import { generateSessionToken } from '$lib/server/auth/magic-link';
import { prisma } from '$lib/server/db/prisma';
import { SESSION_COOKIE_NAME, getCookieOptions } from '$lib/server/config/constants';
import bcrypt from 'bcrypt';
import { checkRateLimit, getClientIP, RATE_LIMITS } from '$lib/server/utils/rate-limit';
import { authLogger } from '$lib/server/utils/logger';

export const actions = {
	default: async ({ request, cookies }) => {
		// Rate limiting: prevent brute force admin login
		const clientIP = getClientIP(request);
		const rateLimitResponse = checkRateLimit(`admin-login:${clientIP}`, RATE_LIMITS.ADMIN_LOGIN);
		if (rateLimitResponse) {
			return fail(429, {
				errors: { general: 'Troppi tentativi. Riprova più tardi.' },
				email: ''
			});
		}

		const formData = await request.formData();
		const email = formData.get('email');
		const password = formData.get('password');

		// Validate email
		const validation = emailSchema.safeParse({ email });

		if (!validation.success) {
			const errors = formatZodErrors(validation.error);
			return fail(400, { errors, email: email as string });
		}

		// Validate password presence
		if (!password || typeof password !== 'string' || password.length === 0) {
			return fail(400, {
				errors: { password: 'La password è obbligatoria' },
				email: validation.data.email
			});
		}

		let admin;
		try {
			// Find admin by email
			admin = await prisma.admin.findUnique({
				where: { email: validation.data.email.toLowerCase().trim() }
			});
		} catch (error) {
			authLogger.error({
				event: 'admin_login_error',
				email: validation.data.email,
				error: error instanceof Error ? error.message : 'Unknown error'
			}, 'Error during admin login - database error');
			return fail(500, {
				errors: { general: 'Errore durante l\'autenticazione. Riprova più tardi.' },
				email: validation.data.email
			});
		}

		// If admin doesn't exist or password doesn't match
		if (!admin) {
			return fail(401, {
				errors: { general: 'Email o password non validi' },
				email: validation.data.email
			});
		}

		// Verify password
		const passwordMatch = await bcrypt.compare(password, admin.password);

		if (!passwordMatch) {
			authLogger.warn({
				event: 'admin_login_failed',
				email: validation.data.email,
				reason: 'invalid_password'
			}, 'Admin login failed - invalid password');
			return fail(401, {
				errors: { general: 'Email o password non validi' },
				email: validation.data.email
			});
		}

		// Generate session token with admin role
		const sessionToken = generateSessionToken(admin.id, admin.email, 'admin');

		// Set session cookie (HttpOnly, secure in production)
		cookies.set(SESSION_COOKIE_NAME, sessionToken, getCookieOptions());

		authLogger.info({
			event: 'admin_login_success',
			adminId: admin.id,
			email: admin.email
		}, 'Admin logged in successfully');

		// Redirect to admin dashboard
		throw redirect(303, '/admin/users');
	}
} satisfies Actions;
