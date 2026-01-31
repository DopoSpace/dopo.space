import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { prisma } from '$lib/server/db/prisma';
import type { Prisma } from '@prisma/client';
import pino from 'pino';

const logger = pino({ name: 'admin-users' });

// Default page size for pagination
const PAGE_SIZE = 50;

/** Status counts for the recap */
export interface StatusCounts {
	total: number;
	active: number;
	awaitingCard: number;
	awaitingPayment: number;
	paymentFailed: number;
	expired: number;
	canceled: number;
	notMember: number;
}

/**
 * Parse date from URL param (YYYY-MM-DD format), returns null if invalid.
 * Parses in local timezone to avoid off-by-one day issues when combined with setHours().
 */
function parseDate(value: string | null): Date | null {
	if (!value) return null;
	// Parse YYYY-MM-DD format explicitly to avoid timezone issues
	const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
	if (!match) {
		// Fall back to Date constructor for other formats
		const date = new Date(value);
		return isNaN(date.getTime()) ? null : date;
	}
	const [, year, month, day] = match;
	// Create date in local timezone (months are 0-indexed)
	const date = new Date(parseInt(year, 10), parseInt(month, 10) - 1, parseInt(day, 10));
	return isNaN(date.getTime()) ? null : date;
}

/** Valid filter status values */
type FilterStatus = 'active' | 'expired' | 'canceled' | 'awaiting_card' | 'awaiting_payment' | 'payment_failed' | 'not_member';

/** Valid sort fields */
type SortField = 'email' | 'firstName' | 'lastName' | 'membershipNumber' | 'status' | 'startDate' | 'endDate' | 'createdAt';
type SortOrder = 'asc' | 'desc';

/** Fields that can be sorted at the database level */
const DB_SORTABLE_FIELDS: SortField[] = ['email', 'firstName', 'lastName', 'createdAt'];

/** Build Prisma orderBy clause from sort parameters (only for DB-sortable fields) */
function buildOrderBy(sort: SortField, order: SortOrder): Prisma.UserOrderByWithRelationInput {
	switch (sort) {
		case 'email':
			return { email: order };
		case 'firstName':
			return { profile: { firstName: order } };
		case 'lastName':
			return { profile: { lastName: order } };
		case 'createdAt':
		default:
			return { createdAt: order };
	}
}

/** Sort users by membership fields (done in-memory after fetch) */
function sortByMembershipField<T extends { membershipNumber: string | null; membershipStatus: string | null; startDate: string | null; endDate: string | null }>(
	users: T[],
	sort: SortField,
	order: SortOrder
): T[] {
	const sorted = [...users];
	const multiplier = order === 'asc' ? 1 : -1;

	sorted.sort((a, b) => {
		let aVal: string | null;
		let bVal: string | null;

		switch (sort) {
			case 'membershipNumber':
				aVal = a.membershipNumber;
				bVal = b.membershipNumber;
				break;
			case 'status':
				aVal = a.membershipStatus;
				bVal = b.membershipStatus;
				break;
			case 'startDate':
				aVal = a.startDate;
				bVal = b.startDate;
				break;
			case 'endDate':
				aVal = a.endDate;
				bVal = b.endDate;
				break;
			default:
				return 0;
		}

		// Nulls go to the end regardless of sort order
		if (aVal === null && bVal === null) return 0;
		if (aVal === null) return 1;
		if (bVal === null) return -1;

		return aVal.localeCompare(bVal) * multiplier;
	});

	return sorted;
}

/** Get user counts by status */
async function getStatusCounts(): Promise<StatusCounts> {
	const [total, active, awaitingCard, awaitingPayment, paymentFailed, expired, canceled, notMember] = await Promise.all([
		prisma.user.count(),
		prisma.user.count({
			where: {
				memberships: {
					some: {
						status: 'ACTIVE',
						membershipNumber: { not: null }
					}
				}
			}
		}),
		prisma.user.count({
			where: {
				memberships: {
					some: {
						paymentStatus: 'SUCCEEDED',
						membershipNumber: null,
						status: { notIn: ['EXPIRED', 'CANCELED'] }
					}
				}
			}
		}),
		prisma.user.count({
			where: {
				memberships: {
					some: {
						paymentStatus: 'PENDING',
						status: { notIn: ['EXPIRED', 'CANCELED'] }
					}
				}
			}
		}),
		prisma.user.count({
			where: {
				memberships: {
					some: {
						paymentStatus: { in: ['FAILED', 'CANCELED'] }
					}
				}
			}
		}),
		prisma.user.count({
			where: {
				memberships: {
					some: { status: 'EXPIRED' }
				}
			}
		}),
		prisma.user.count({
			where: {
				memberships: {
					some: { status: 'CANCELED' }
				}
			}
		}),
		prisma.user.count({
			where: {
				memberships: { none: {} }
			}
		})
	]);

	return { total, active, awaitingCard, awaitingPayment, paymentFailed, expired, canceled, notMember };
}

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

	// Get filter parameters
	const status = url.searchParams.get('status') as FilterStatus | null;
	const registeredFrom = parseDate(url.searchParams.get('registeredFrom'));
	const registeredTo = parseDate(url.searchParams.get('registeredTo'));
	const startDateFrom = parseDate(url.searchParams.get('startDateFrom'));
	const startDateTo = parseDate(url.searchParams.get('startDateTo'));
	const endDateFrom = parseDate(url.searchParams.get('endDateFrom'));
	const endDateTo = parseDate(url.searchParams.get('endDateTo'));

	// Get sort parameters
	const validSortFields: SortField[] = ['email', 'firstName', 'lastName', 'membershipNumber', 'status', 'startDate', 'endDate', 'createdAt'];
	const rawSort = url.searchParams.get('sort') || 'createdAt';
	const sort: SortField = validSortFields.includes(rawSort as SortField) ? (rawSort as SortField) : 'createdAt';
	const rawOrder = url.searchParams.get('order') || 'desc';
	const order: SortOrder = rawOrder === 'asc' ? 'asc' : 'desc';
	const isMembershipSort = !DB_SORTABLE_FIELDS.includes(sort);

	// Build where clause
	const conditions: Prisma.UserWhereInput[] = [];

	// Text search
	if (search) {
		conditions.push({
			OR: [
				{ email: { contains: search, mode: 'insensitive' } },
				{ profile: { firstName: { contains: search, mode: 'insensitive' } } },
				{ profile: { lastName: { contains: search, mode: 'insensitive' } } },
				{ memberships: { some: { membershipNumber: { contains: search, mode: 'insensitive' } } } }
			]
		});
	}

	// Registration date filter
	if (registeredFrom || registeredTo) {
		const createdAtFilter: Prisma.DateTimeFilter = {};
		if (registeredFrom) createdAtFilter.gte = registeredFrom;
		if (registeredTo) {
			// Include the entire end day
			const endOfDay = new Date(registeredTo);
			endOfDay.setHours(23, 59, 59, 999);
			createdAtFilter.lte = endOfDay;
		}
		conditions.push({ createdAt: createdAtFilter });
	}

	// Status filter - maps to membership status/payment status combinations
	if (status) {
		switch (status) {
			case 'active':
				conditions.push({
					memberships: {
						some: {
							status: 'ACTIVE',
							membershipNumber: { not: null }
						}
					}
				});
				break;
			case 'expired':
				conditions.push({
					memberships: {
						some: { status: 'EXPIRED' }
					}
				});
				break;
			case 'canceled':
				conditions.push({
					memberships: {
						some: { status: 'CANCELED' }
					}
				});
				break;
			case 'awaiting_card':
				conditions.push({
					memberships: {
						some: {
							paymentStatus: 'SUCCEEDED',
							membershipNumber: null,
							status: { notIn: ['EXPIRED', 'CANCELED'] }
						}
					}
				});
				break;
			case 'awaiting_payment':
				conditions.push({
					memberships: {
						some: {
							paymentStatus: 'PENDING',
							status: { notIn: ['EXPIRED', 'CANCELED'] }
						}
					}
				});
				break;
			case 'payment_failed':
				conditions.push({
					memberships: {
						some: {
							paymentStatus: { in: ['FAILED', 'CANCELED'] }
						}
					}
				});
				break;
			case 'not_member':
				conditions.push({
					memberships: { none: {} }
				});
				break;
		}
	}

	// Membership start date filter
	if (startDateFrom || startDateTo) {
		const startDateFilter: Prisma.DateTimeNullableFilter = {};
		if (startDateFrom) startDateFilter.gte = startDateFrom;
		if (startDateTo) {
			const endOfDay = new Date(startDateTo);
			endOfDay.setHours(23, 59, 59, 999);
			startDateFilter.lte = endOfDay;
		}
		conditions.push({
			memberships: {
				some: { startDate: startDateFilter }
			}
		});
	}

	// Membership end date filter
	if (endDateFrom || endDateTo) {
		const endDateFilter: Prisma.DateTimeNullableFilter = {};
		if (endDateFrom) endDateFilter.gte = endDateFrom;
		if (endDateTo) {
			const endOfDay = new Date(endDateTo);
			endOfDay.setHours(23, 59, 59, 999);
			endDateFilter.lte = endOfDay;
		}
		conditions.push({
			memberships: {
				some: { endDate: endDateFilter }
			}
		});
	}

	const whereClause: Prisma.UserWhereInput = conditions.length > 0 ? { AND: conditions } : {};

	// Build filters object to pass to frontend
	const filters = {
		status: status || '',
		registeredFrom: registeredFrom?.toISOString().split('T')[0] || '',
		registeredTo: registeredTo?.toISOString().split('T')[0] || '',
		startDateFrom: startDateFrom?.toISOString().split('T')[0] || '',
		startDateTo: startDateTo?.toISOString().split('T')[0] || '',
		endDateFrom: endDateFrom?.toISOString().split('T')[0] || '',
		endDateTo: endDateTo?.toISOString().split('T')[0] || ''
	};

	const hasActiveFilters = Object.values(filters).some(v => v !== '');

	try {
		// Get status counts (cached for display)
		const statusCounts = await getStatusCounts();

		let mappedUsers: Array<{
			id: string;
			email: string;
			taxCode: string | null;
			firstName: string;
			lastName: string;
			profileComplete: boolean;
			membershipNumber: string | null;
			membershipStatus: string | null;
			paymentStatus: string | null;
			startDate: string | null;
			endDate: string | null;
			createdAt: string;
		}>;
		let totalCount: number;

		if (isMembershipSort) {
			// For membership field sorting, we need to sort ALL matching users first,
			// then paginate. This ensures correct sorting across pages.
			const allUsers = await prisma.user.findMany({
				where: whereClause,
				include: {
					profile: {
						select: {
							firstName: true,
							lastName: true,
							taxCode: true,
							profileComplete: true
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
				}
			});

			totalCount = allUsers.length;

			// Map all users
			const allMappedUsers = allUsers.map((user) => ({
				id: user.id,
				email: user.email,
				taxCode: user.profile?.taxCode || null,
				firstName: user.profile?.firstName || '-',
				lastName: user.profile?.lastName || '-',
				profileComplete: user.profile?.profileComplete || false,
				membershipNumber: user.memberships[0]?.membershipNumber || null,
				membershipStatus: user.memberships[0]?.status || null,
				paymentStatus: user.memberships[0]?.paymentStatus || null,
				startDate: user.memberships[0]?.startDate?.toISOString() || null,
				endDate: user.memberships[0]?.endDate?.toISOString() || null,
				createdAt: user.createdAt.toISOString()
			}));

			// Sort all users by membership field
			const sortedUsers = sortByMembershipField(allMappedUsers, sort, order);

			// Paginate
			mappedUsers = sortedUsers.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
		} else {
			// For DB-sortable fields, use efficient DB-level pagination
			const [users, count] = await Promise.all([
				prisma.user.findMany({
					where: whereClause,
					include: {
						profile: {
							select: {
								firstName: true,
								lastName: true,
								taxCode: true,
								profileComplete: true
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
					orderBy: buildOrderBy(sort, order),
					skip: (page - 1) * PAGE_SIZE,
					take: PAGE_SIZE
				}),
				prisma.user.count({ where: whereClause })
			]);

			totalCount = count;

			// Map users to response format
			mappedUsers = users.map((user) => ({
				id: user.id,
				email: user.email,
				taxCode: user.profile?.taxCode || null,
				firstName: user.profile?.firstName || '-',
				lastName: user.profile?.lastName || '-',
				profileComplete: user.profile?.profileComplete || false,
				membershipNumber: user.memberships[0]?.membershipNumber || null,
				membershipStatus: user.memberships[0]?.status || null,
				paymentStatus: user.memberships[0]?.paymentStatus || null,
				startDate: user.memberships[0]?.startDate?.toISOString() || null,
				endDate: user.memberships[0]?.endDate?.toISOString() || null,
				createdAt: user.createdAt.toISOString()
			}));
		}

		// Get all matching user IDs for "select all" functionality
		const allUserIds = await prisma.user.findMany({
			where: whereClause,
			select: { id: true }
		}).then(users => users.map(u => u.id));

		return {
			users: mappedUsers,
			allUserIds,
			search,
			filters,
			hasActiveFilters,
			sort,
			order,
			statusCounts,
			pagination: {
				page,
				pageSize: PAGE_SIZE,
				totalCount,
				totalPages: Math.max(1, Math.ceil(totalCount / PAGE_SIZE))
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
