import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { prisma } from '$lib/server/db/prisma';
import { simpleSubscriptionSchema, formatZodErrors } from '$lib/server/utils/validation';

export const load: PageServerLoad = async ({ locals, params }) => {
	// Admin is guaranteed to be authenticated by hooks.server.ts
	const admin = locals.admin;

	if (!admin) {
		throw redirect(303, '/auth/login');
	}

	// Fetch user with profile
	const user = await prisma.user.findUnique({
		where: { id: params.id },
		include: {
			profile: true
		}
	});

	if (!user) {
		throw error(404, 'Utente non trovato');
	}

	return {
		user: {
			id: user.id,
			email: user.email,
			phone: user.phone,
			newsletterSubscribed: user.newsletterSubscribed,
			createdAt: user.createdAt.toISOString(),
			updatedAt: user.updatedAt.toISOString(),
			profile: user.profile
				? {
						firstName: user.profile.firstName,
						lastName: user.profile.lastName,
						birthDate: user.profile.birthDate.toISOString(),
						address: user.profile.address,
						city: user.profile.city,
						postalCode: user.profile.postalCode,
						province: user.profile.province,
						taxCode: user.profile.taxCode,
						profileComplete: user.profile.profileComplete
					}
				: null
		},
		admin: {
			email: admin.email
		}
	};
};

export const actions = {
	update: async ({ request, params, locals }) => {
		const admin = locals.admin;

		if (!admin) {
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
			// Check if user exists
			const user = await prisma.user.findUnique({
				where: { id: params.id },
				include: { profile: true }
			});

			if (!user) {
				return fail(404, {
					errors: { _form: 'Utente non trovato' }
				});
			}

			// Update profile
			if (user.profile) {
				await prisma.userProfile.update({
					where: { userId: user.id },
					data: {
						firstName: validation.data.firstName,
						lastName: validation.data.lastName
					}
				});
			} else {
				// Create profile if doesn't exist
				await prisma.userProfile.create({
					data: {
						userId: user.id,
						firstName: validation.data.firstName,
						lastName: validation.data.lastName,
						// Placeholder values
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
		} catch (err) {
			console.error('Error updating user:', err);
			return fail(500, {
				errors: { _form: 'Errore durante l\'aggiornamento. Riprova più tardi.' },
				values: { firstName: validation.data.firstName, lastName: validation.data.lastName }
			});
		}
	}
} satisfies Actions;
