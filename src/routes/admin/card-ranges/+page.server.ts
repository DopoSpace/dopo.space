import { redirect, fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import {
	addCardNumberRange,
	getCardNumberRangesWithStats,
	deleteCardNumberRange,
	getAssignedNumbers
} from '$lib/server/services/card-ranges';
import { addCardRangeSchema, formatZodErrors } from '$lib/server/utils/validation';

export const load: PageServerLoad = async ({ locals }) => {
	const admin = locals.admin;

	if (!admin) {
		throw redirect(303, '/auth/login');
	}

	// Get ranges with statistics (global pool)
	const ranges = await getCardNumberRangesWithStats();

	// Get all assigned numbers
	const assignedNumbersRaw = await getAssignedNumbers();
	const assignedNumbers = assignedNumbersRaw.map((m) => ({
		membershipNumber: m.membershipNumber,
		email: m.user.email,
		firstName: m.user.profile?.firstName || '-',
		lastName: m.user.profile?.lastName || '-'
	}));

	return {
		admin: { email: admin.email, name: admin.name },
		ranges: ranges.map((r) => ({
			id: r.id,
			startNumber: r.startNumber,
			endNumber: r.endNumber,
			totalNumbers: r.totalNumbers,
			usedNumbers: r.usedNumbers,
			availableNumbers: r.availableNumbers,
			createdAt: r.createdAt.toISOString(),
			createdBy: r.createdBy
		})),
		assignedNumbers
	};
};

export const actions: Actions = {
	addRange: async ({ request, locals }) => {
		const admin = locals.admin;
		if (!admin) {
			return fail(401, { errors: { _form: 'Non autorizzato' } });
		}

		const formData = await request.formData();

		const startNumber = formData.get('startNumber') as string;
		const endNumber = formData.get('endNumber') as string;

		// Validate input
		const validation = addCardRangeSchema.safeParse({
			startNumber,
			endNumber
		});

		if (!validation.success) {
			return fail(400, {
				errors: formatZodErrors(validation.error),
				values: { startNumber, endNumber }
			});
		}

		// Add range (global pool)
		const result = await addCardNumberRange(
			validation.data.startNumber,
			validation.data.endNumber,
			admin.id
		);

		if (!result.success) {
			return fail(400, {
				errors: { _form: result.error || 'Errore durante la creazione del range' },
				conflicts: result.conflicts,
				values: { startNumber, endNumber }
			});
		}

		return { success: true, range: result.range };
	},

	deleteRange: async ({ request, locals }) => {
		const admin = locals.admin;
		if (!admin) {
			return fail(401, { errors: { _form: 'Non autorizzato' } });
		}

		const formData = await request.formData();
		const rangeId = formData.get('rangeId') as string;

		if (!rangeId) {
			return fail(400, { errors: { _form: 'Range ID mancante' } });
		}

		const result = await deleteCardNumberRange(rangeId);

		if (!result.success) {
			return fail(400, { errors: { _form: result.error || 'Errore durante l\'eliminazione' } });
		}

		return { success: true, deleted: true };
	}
};
