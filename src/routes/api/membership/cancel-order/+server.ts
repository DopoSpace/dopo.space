/**
 * Cancel PayPal Order API
 *
 * Resets membership state when user cancels payment on PayPal.
 * This allows them to retry the payment.
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { prisma } from '$lib/server/db/prisma';
import { PaymentStatus } from '@prisma/client';
import { createLogger } from '$lib/server/utils/logger';

const logger = createLogger({ module: 'cancel-order' });

export const POST: RequestHandler = async ({ locals }) => {
	// Verify user is authenticated
	const user = locals.user;
	if (!user) {
		throw error(401, 'Non autorizzato');
	}

	try {
		// Find pending membership with payment provider ID (means payment was started)
		const membership = await prisma.membership.findFirst({
			where: {
				userId: user.id,
				paymentStatus: PaymentStatus.PENDING,
				paymentProviderId: { not: null }
			},
			orderBy: { createdAt: 'desc' }
		});

		if (!membership) {
			// No pending payment to cancel - that's fine
			return json({ success: true, message: 'Nessun pagamento in corso' });
		}

		// Reset the membership so user can retry
		// We clear the paymentProviderId so they can create a new order
		await prisma.membership.update({
			where: { id: membership.id },
			data: {
				paymentProviderId: null
			}
		});

		logger.info(
			{ userId: user.id, membershipId: membership.id },
			'Payment canceled by user, membership reset for retry'
		);

		return json({ success: true });
	} catch (err) {
		logger.error({ err, userId: user.id }, 'Failed to cancel order');
		throw error(500, 'Errore durante l\'annullamento. Riprova più tardi.');
	}
};
