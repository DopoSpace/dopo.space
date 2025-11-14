import { fail, redirect } from '@sveltejs/kit';
import type { Actions } from './$types';
import { emailSchema } from '$lib/server/utils/validation';
import { generateSessionToken } from '$lib/server/auth/magic-link';
import { prisma } from '$lib/server/db/prisma';
import bcrypt from 'bcrypt';

export const actions = {
	default: async ({ request, cookies }) => {
		const formData = await request.formData();
		const email = formData.get('email');
		const password = formData.get('password');

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

		// Validate password presence
		if (!password || typeof password !== 'string' || password.length === 0) {
			return fail(400, {
				errors: { password: 'La password è obbligatoria' },
				email: validation.data.email
			});
		}

		try {
			// Find admin by email
			const admin = await prisma.admin.findUnique({
				where: { email: validation.data.email }
			});

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
				return fail(401, {
					errors: { general: 'Email o password non validi' },
					email: validation.data.email
				});
			}

			// Generate session token
			const sessionToken = generateSessionToken(admin.id, admin.email);

			// Set session cookie (HttpOnly, secure in production)
			cookies.set('session', sessionToken, {
				path: '/',
				httpOnly: true,
				secure: process.env.NODE_ENV === 'production',
				sameSite: 'lax',
				maxAge: 60 * 60 * 24 * 7 // 7 days
			});

			// Redirect to admin dashboard
			throw redirect(303, '/admin/users');
		} catch (error) {
			// If error is a redirect, rethrow it
			if (error instanceof Response && error.status === 303) {
				throw error;
			}

			console.error('Error during admin login:', error);
			return fail(500, {
				errors: { general: 'Errore durante l\'autenticazione. Riprova più tardi.' },
				email: validation.data.email
			});
		}
	}
} satisfies Actions;
