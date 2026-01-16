import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { prisma } from '$lib/server/db/prisma';
import pino from 'pino';

const logger = pino({ name: 'admin-users' });

// Default page size for pagination
const PAGE_SIZE = 50;

export const load: PageServerLoad = async ({ locals, url }) => {
	// Admin is guaranteed to be authenticated by hooks.server.ts
	const admin = locals.admin;

	if (!admin) {
		throw redirect(303, '/login');
	}

	// Get search query from URL params and sanitize
	const rawSearch = url.searchParams.get('search') || '';
	// Sanitize: trim, limit length, remove dangerous characters
	const search = rawSearch.trim().slice(0, 100).replace(/[<>]/g, '');

	// Get pagination parameters
	const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));

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

	try {
		// Fetch users with profiles and latest membership (for card number) with pagination
		const [users, totalCount] = await Promise.all([
			prisma.user.findMany({
				where: whereClause,
				include: {
					profile: {
						select: {
							firstName: true,
							lastName: true
						}
					},
					memberships: {
						select: {
							membershipNumber: true,
							status: true,
							paymentStatus: true,
							startDate: true,
							endDate: true
						},
						orderBy: {
							createdAt: 'desc'
						},
						take: 1
					}
				},
				orderBy: {
					createdAt: 'desc'
				},
				skip: (page - 1) * PAGE_SIZE,
				take: PAGE_SIZE
			}),
			prisma.user.count({ where: whereClause })
		]);

		return {
			users: users.map((user) => ({
				id: user.id,
				email: user.email,
				firstName: user.profile?.firstName || '-',
				lastName: user.profile?.lastName || '-',
				membershipNumber: user.memberships[0]?.membershipNumber || null,
				membershipStatus: user.memberships[0]?.status || null,
				paymentStatus: user.memberships[0]?.paymentStatus || null,
				startDate: user.memberships[0]?.startDate?.toISOString() || null,
				endDate: user.memberships[0]?.endDate?.toISOString() || null,
				createdAt: user.createdAt.toISOString()
			})),
			search,
			pagination: {
				page,
				pageSize: PAGE_SIZE,
				totalCount,
				totalPages: Math.ceil(totalCount / PAGE_SIZE)
			},
			admin: {
				email: admin.email,
				name: admin.name
			}
		};
	} catch (err) {
		logger.error({ err, search }, 'Failed to fetch users list');
		throw error(500, 'Impossibile caricare la lista utenti. Riprova più tardi.');
	}
};
