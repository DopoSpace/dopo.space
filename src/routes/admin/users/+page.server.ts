import { redirect, fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { prisma } from '$lib/server/db/prisma';
import { getUsersAwaitingCard, batchAssignMembershipNumbers, type BatchAssignResult } from '$lib/server/services/membership';
import { batchAssignCardsSchema, formatZodErrors } from '$lib/server/utils/validation';

export const load: PageServerLoad = async ({ locals, url }) => {
	// Admin is guaranteed to be authenticated by hooks.server.ts
	const admin = locals.admin;

	if (!admin) {
		throw redirect(303, '/auth/login');
	}

	// Get search query from URL params and sanitize
	const rawSearch = url.searchParams.get('search') || '';
	// Sanitize: trim, limit length, remove dangerous characters
	const search = rawSearch.trim().slice(0, 100).replace(/[<>]/g, '');

	// Build where clause for search
	const whereClause = search
		? {
				OR: [
					{ email: { contains: search, mode: 'insensitive' as const } },
					{ profile: { firstName: { contains: search, mode: 'insensitive' as const } } },
					{ profile: { lastName: { contains: search, mode: 'insensitive' as const } } }
				]
			}
		: {};

	// Fetch users with profiles
	const users = await prisma.user.findMany({
		where: whereClause,
		include: {
			profile: {
				select: {
					firstName: true,
					lastName: true
				}
			}
		},
		orderBy: {
			createdAt: 'desc'
		}
	});

	// Fetch users awaiting card assignment (S4 state)
	const usersAwaitingCardRaw = await getUsersAwaitingCard();
	const usersAwaitingCard = usersAwaitingCardRaw.map((user) => ({
		id: user.id,
		email: user.email,
		firstName: user.profile?.firstName || '-',
		lastName: user.profile?.lastName || '-',
		paymentDate: user.memberships[0]?.createdAt.toISOString() || null
	}));

	return {
		users: users.map((user) => ({
			id: user.id,
			email: user.email,
			firstName: user.profile?.firstName || '-',
			lastName: user.profile?.lastName || '-',
			createdAt: user.createdAt.toISOString()
		})),
		usersAwaitingCard,
		search,
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

		// Extract form values
		const prefix = formData.get('prefix') as string || '';
		const startNumber = formData.get('startNumber') as string || '';
		const endNumber = formData.get('endNumber') as string || '';
		const userIds = formData.getAll('userIds') as string[];

		// Validate
		const validation = batchAssignCardsSchema.safeParse({
			prefix,
			startNumber,
			endNumber,
			userIds
		});

		if (!validation.success) {
			return fail(400, {
				errors: formatZodErrors(validation.error),
				values: { prefix, startNumber, endNumber }
			});
		}

		try {
			// Execute batch assignment
			const result = await batchAssignMembershipNumbers(
				validation.data.prefix || '',
				validation.data.startNumber,
				validation.data.endNumber,
				validation.data.userIds
			);

			return {
				success: true,
				result
			};
		} catch (error) {
			return fail(500, {
				errors: { _form: error instanceof Error ? error.message : 'Errore durante l\'assegnazione' },
				values: { prefix, startNumber, endNumber }
			});
		}
	}
};
