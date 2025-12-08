import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { prisma } from '$lib/server/db/prisma';
import { simpleSubscriptionSchema, formatZodErrors } from '$lib/server/utils/validation';
import { createLogger } from '$lib/server/utils/logger';

const logger = createLogger({ module: 'admin' });

export const load: PageServerLoad = async ({ locals, params }) => {
	// Admin is guaranteed to be authenticated by hooks.server.ts
	const admin = locals.admin;

	if (!admin) {
		throw redirect(303, '/auth/login');
	}

	// Fetch user with profile and latest membership
	const user = await prisma.user.findUnique({
		where: { id: params.id },
		include: {
			profile: true,
			memberships: {
				orderBy: {
					createdAt: 'desc'
				},
				take: 1,
				include: {
					associationYear: true
				}
			}
		}
	});

	if (!user) {
		throw error(404, 'Utente non trovato');
	}

	const latestMembership = user.memberships[0];

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
						birthDate: user.profile.birthDate?.toISOString() || null,
						address: user.profile.address,
						city: user.profile.city,
						postalCode: user.profile.postalCode,
						province: user.profile.province,
						taxCode: user.profile.taxCode,
						profileComplete: user.profile.profileComplete
					}
				: null,
			membership: latestMembership
				? {
						membershipNumber: latestMembership.membershipNumber,
						status: latestMembership.status,
						paymentStatus: latestMembership.paymentStatus,
						startDate: latestMembership.startDate?.toISOString() || null,
						endDate: latestMembership.endDate?.toISOString() || null
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

			// Don't return anything - SvelteKit will automatically re-run the load function
			// This ensures the page data is refreshed with the new values
		} catch (err) {
			logger.error({ err }, 'Error updating user');
			return fail(500, {
				errors: { _form: 'Errore durante l\'aggiornamento. Riprova più tardi.' },
				values: { firstName: validation.data.firstName, lastName: validation.data.lastName }
			});
		}
	}
} satisfies Actions;
