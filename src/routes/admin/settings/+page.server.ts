/**
 * Admin Settings Page Server
 *
 * Allows admins to manage application settings like membership fee.
 */

import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getMembershipFee, setMembershipFee } from '$lib/server/services/settings';
import { z } from 'zod';

export const load: PageServerLoad = async () => {
	const membershipFee = await getMembershipFee();

	return {
		membershipFee
	};
};

const updateFeeSchema = z.object({
	membershipFee: z
		.string()
		.min(1, 'Il costo è obbligatorio')
		.transform((val) => {
			// Parse as float and convert to cents
			const euros = parseFloat(val.replace(',', '.'));
			if (isNaN(euros)) {
				throw new Error('Formato non valido');
			}
			return Math.round(euros * 100);
		})
		.refine((val) => val > 0, 'Il costo deve essere maggiore di 0')
		.refine((val) => val <= 100000, 'Il costo non può superare €1000')
});

export const actions = {
	updateFee: async ({ request }) => {
		const formData = await request.formData();
		const membershipFee = formData.get('membershipFee');

		const result = updateFeeSchema.safeParse({ membershipFee });

		if (!result.success) {
			return fail(400, {
				error: result.error.issues[0]?.message || 'Valore non valido',
				value: membershipFee as string
			});
		}

		try {
			await setMembershipFee(result.data.membershipFee);

			return {
				success: true,
				message: 'Costo tessera aggiornato con successo'
			};
		} catch (error) {
			return fail(500, {
				error: 'Errore nel salvataggio. Riprova più tardi.',
				value: membershipFee as string
			});
		}
	}
} satisfies Actions;
