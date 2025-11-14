import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { simpleSubscriptionSchema, formatZodErrors } from '$lib/server/utils/validation';
import { prisma } from '$lib/server/db/prisma';

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
			// Check if profile exists
			const existingProfile = await prisma.userProfile.findUnique({
				where: { userId: user.id }
			});

			if (existingProfile) {
				// Update existing profile (only firstName and lastName)
				await prisma.userProfile.update({
					where: { userId: user.id },
					data: {
						firstName: validation.data.firstName,
						lastName: validation.data.lastName
					}
				});
			} else {
				// Create new profile with placeholder values for required fields
				// These will be filled in when the user completes the full profile later
				await prisma.userProfile.create({
					data: {
						userId: user.id,
						firstName: validation.data.firstName,
						lastName: validation.data.lastName,
						// Placeholder values for required fields (temporary)
						birthDate: new Date('2000-01-01'),
						address: 'Da completare',
						city: 'Da completare',
						postalCode: '00000',
						province: 'XX',
						privacyConsent: false,
						dataConsent: false,
						profileComplete: false
					}
				});
			}

			return {
				success: true
			};
		} catch (error) {
			console.error('Error saving profile:', error);
			return fail(500, {
				errors: { _form: 'Errore durante il salvataggio. Riprova più tardi.' },
				values: { firstName: validation.data.firstName, lastName: validation.data.lastName }
			});
		}
	}
} satisfies Actions;
