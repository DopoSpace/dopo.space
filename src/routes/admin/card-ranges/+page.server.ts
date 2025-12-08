import { redirect, fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { prisma } from '$lib/server/db/prisma';
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

	// Get active association year
	const activeYear = await prisma.associationYear.findFirst({
		where: { isActive: true }
	});

	if (!activeYear) {
		return {
			admin: { email: admin.email, name: admin.name },
			activeYear: null,
			ranges: [],
			assignedNumbers: [],
			error: 'Nessun anno associativo attivo'
		};
	}

	// Get ranges with statistics
	const ranges = await getCardNumberRangesWithStats(activeYear.id);

	// Get assigned numbers for this year
	const assignedNumbersRaw = await getAssignedNumbers(activeYear.id);
	const assignedNumbers = assignedNumbersRaw.map((m) => ({
		membershipNumber: m.membershipNumber,
		email: m.user.email,
		firstName: m.user.profile?.firstName || '-',
		lastName: m.user.profile?.lastName || '-'
	}));

	return {
		admin: { email: admin.email, name: admin.name },
		activeYear: {
			id: activeYear.id,
			startDate: activeYear.startDate.toISOString(),
			endDate: activeYear.endDate.toISOString()
		},
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

		// Get active year
		const activeYear = await prisma.associationYear.findFirst({
			where: { isActive: true }
		});

		if (!activeYear) {
			return fail(400, {
				errors: { _form: 'Nessun anno associativo attivo' },
				values: { startNumber, endNumber }
			});
		}

		// Add range
		const result = await addCardNumberRange(
			validation.data.startNumber,
			validation.data.endNumber,
			activeYear.id,
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
