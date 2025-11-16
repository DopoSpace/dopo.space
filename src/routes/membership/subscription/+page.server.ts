import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { simpleSubscriptionSchema, formatZodErrors } from '$lib/server/utils/validation';
import { prisma } from '$lib/server/db/prisma';
import { createLogger } from '$lib/server/utils/logger';

const logger = createLogger({ module: 'membership' });

export const load: PageServerLoad = async ({ locals }) => {
	// User is guaranteed to be authenticated by hooks.server.ts
	const user = locals.user;

	if (!user) {
		throw redirect(303, '/auth/login');
	}

	// Check if user already has a profile
	const profile = await prisma.userProfile.findUnique({
		where: { userId: user.id },
		select: {
			firstName: true,
			lastName: true
		}
	});

	return {
		user: {
			email: user.email,
			firstName: profile?.firstName,
			lastName: profile?.lastName
		}
	};
};

export const actions = {
	default: async ({ request, locals }) => {
		const user = locals.user;

		if (!user) {
			return fail(401, { errors: { _form: 'Non autorizzato' } });
		}

		const formData = await request.formData();
		const firstName = formData.get('firstName');
		const lastName = formData.get('lastName');

		// Validate input
		const validation = simpleSubscriptionSchema.safeParse({
			firstName,
			lastName
		});

		if (!validation.success) {
			const errors = formatZodErrors(validation.error);
			return fail(400, {
				errors,
				values: { firstName: firstName as string, lastName: lastName as string }
			});
		}

		try {
			// Use upsert to atomically create or update profile (prevents race conditions)
			await prisma.userProfile.upsert({
				where: { userId: user.id },
				update: {
					firstName: validation.data.firstName,
					lastName: validation.data.lastName
				},
				create: {
					userId: user.id,
					firstName: validation.data.firstName,
					lastName: validation.data.lastName
					// All other fields (birthDate, address, consents) are nullable
					// and will be filled when user completes full profile
				}
			});

			// Return the updated values to prevent form field clearing during invalidateAll
			// This ensures inputs show correct values until load function completes
			return {
				success: true,
				values: { firstName: validation.data.firstName, lastName: validation.data.lastName }
			};
		} catch (error) {
			logger.error('Error saving profile:', error);
			return fail(500, {
				errors: { _form: 'Errore durante il salvataggio. Riprova più tardi.' },
				values: { firstName: validation.data.firstName, lastName: validation.data.lastName }
			});
		}
	}
} satisfies Actions;
