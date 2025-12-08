import { redirect, fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { prisma } from '$lib/server/db/prisma';
import {
	getUsersAwaitingCard,
	autoAssignMembershipNumbers,
	type AutoAssignResult
} from '$lib/server/services/membership';
import { getAvailableNumbersCount } from '$lib/server/services/card-ranges';
import { autoAssignCardsSchema, formatZodErrors } from '$lib/server/utils/validation';

export const load: PageServerLoad = async ({ locals }) => {
	const admin = locals.admin;

	if (!admin) {
		throw redirect(303, '/admin/login');
	}

	// Fetch users awaiting card assignment (S4 state)
	const usersAwaitingCardRaw = await getUsersAwaitingCard();
	const usersAwaitingCard = usersAwaitingCardRaw.map((user) => ({
		id: user.id,
		email: user.email,
		firstName: user.profile?.firstName || '-',
		lastName: user.profile?.lastName || '-',
		paymentDate: user.memberships[0]?.createdAt.toISOString() || null
	}));

	// Get available numbers count from configured ranges
	const activeYear = await prisma.associationYear.findFirst({
		where: { isActive: true }
	});
	const availableNumbersCount = activeYear
		? await getAvailableNumbersCount(activeYear.id)
		: 0;

	return {
		usersAwaitingCard,
		availableNumbersCount,
		admin: {
			email: admin.email,
			name: admin.name
		}
	};
};

export const actions: Actions = {
	assignCards: async ({ request, locals }) => {
		const admin = locals.admin;
		if (!admin) {
			return fail(401, { errors: { _form: 'Non autorizzato' } });
		}

		const formData = await request.formData();
		const userIds = formData.getAll('userIds') as string[];

		// Validate
		const validation = autoAssignCardsSchema.safeParse({ userIds });

		if (!validation.success) {
			return fail(400, {
				errors: formatZodErrors(validation.error)
			});
		}

		try {
			// Execute automatic assignment from configured ranges
			const result = await autoAssignMembershipNumbers(validation.data.userIds);

			return {
				success: true,
				result
			};
		} catch (error) {
			return fail(500, {
				errors: { _form: error instanceof Error ? error.message : 'Errore durante l\'assegnazione' }
			});
		}
	}
};
