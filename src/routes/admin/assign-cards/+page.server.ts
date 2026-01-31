import { redirect, fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import {
	getUsersAwaitingCard,
	autoAssignMembershipNumbers,
	batchAssignMembershipNumbers,
	assignSingleMembershipNumber,
	type AutoAssignResult,
	type BatchAssignResult,
	type SingleAssignResult
} from '$lib/server/services/membership';
import { getAvailableNumbersCount, getCardNumberRangesWithStats } from '$lib/server/services/card-ranges';
import { assignCardsSchema, formatZodErrors } from '$lib/server/utils/validation';
import { createLogger } from '$lib/server/utils/logger';

const logger = createLogger({ module: 'admin-assign-cards' });

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

	// Get available numbers count from global pool
	const availableNumbersCount = await getAvailableNumbersCount();

	// Get configured card ranges for display
	const cardRangesRaw = await getCardNumberRangesWithStats();
	const cardRanges = cardRangesRaw.map((range) => ({
		id: range.id,
		startNumber: range.startNumber,
		endNumber: range.endNumber,
		totalNumbers: range.totalNumbers,
		usedNumbers: range.usedNumbers,
		availableNumbers: range.availableNumbers,
		availableSubRanges: range.availableSubRanges
	}));

	return {
		usersAwaitingCard,
		availableNumbersCount,
		cardRanges,
		admin: {
			email: admin.email,
			name: admin.name
		}
	};
};

/** Unified result type for all assignment modes */
export type AssignmentResult =
	| { mode: 'auto'; data: AutoAssignResult }
	| { mode: 'range'; data: BatchAssignResult }
	| { mode: 'single'; data: SingleAssignResult };

export const actions: Actions = {
	assignCards: async ({ request, locals }) => {
		const admin = locals.admin;
		if (!admin) {
			return fail(401, { errors: { _form: 'Non autorizzato' } });
		}

		const formData = await request.formData();
		const mode = formData.get('mode') as string;
		const userIds = formData.getAll('userIds') as string[];
		const startNumber = formData.get('startNumber') as string | null;
		const endNumber = formData.get('endNumber') as string | null;
		const membershipNumber = formData.get('membershipNumber') as string | null;

		// Build validation object based on mode
		const validationData: Record<string, unknown> = { mode, userIds };
		if (mode === 'range') {
			validationData.startNumber = startNumber || '';
			validationData.endNumber = endNumber || '';
		} else if (mode === 'single') {
			validationData.membershipNumber = membershipNumber || '';
		}

		// Validate
		const validation = assignCardsSchema.safeParse(validationData);

		if (!validation.success) {
			return fail(400, {
				errors: formatZodErrors(validation.error)
			});
		}

		try {
			let result: AssignmentResult;

			switch (validation.data.mode) {
				case 'auto': {
					const autoResult = await autoAssignMembershipNumbers(validation.data.userIds);
					result = { mode: 'auto', data: autoResult };
					break;
				}

				case 'range': {
					const rangeResult = await batchAssignMembershipNumbers(
						'', // No prefix
						validation.data.startNumber,
						validation.data.endNumber,
						validation.data.userIds
					);
					result = { mode: 'range', data: rangeResult };
					break;
				}

				case 'single': {
					const singleResult = await assignSingleMembershipNumber(
						validation.data.userIds[0],
						validation.data.membershipNumber
					);
					result = { mode: 'single', data: singleResult };
					break;
				}
			}

			// Extract IDs of users who actually got a card assigned
			let assignedUserIds: string[] = [];
			switch (result.mode) {
				case 'auto':
				case 'range':
					assignedUserIds = result.data.assigned.map((a) => a.userId);
					break;
				case 'single':
					assignedUserIds = [validation.data.userIds[0]];
					break;
			}

			return {
				success: true,
				result,
				assignedUserIds
			};
		} catch (error) {
			logger.error({ err: error, mode, userIds }, 'Failed to assign membership numbers');
			return fail(500, {
				errors: { _form: error instanceof Error ? error.message : 'Errore durante l\'assegnazione' }
			});
		}
	}
};
