import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { prisma } from '$lib/server/db/prisma';

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

	return {
		users: users.map((user) => ({
			id: user.id,
			email: user.email,
			firstName: user.profile?.firstName || '-',
			lastName: user.profile?.lastName || '-',
			createdAt: user.createdAt.toISOString()
		})),
		search,
		admin: {
			email: admin.email,
			name: admin.name
		}
	};
};
