/**
 * Create PayPal Order API
 *
 * Creates a PayPal order for membership payment.
 * Requires authenticated user with complete profile and pending membership.
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { prisma } from '$lib/server/db/prisma';
import { createPayPalOrder } from '$lib/server/integrations/paypal';
import { getMembershipSummary, createMembershipForPayment } from '$lib/server/services/membership';
import { getMembershipFee } from '$lib/server/services/settings';
import { SystemState } from '$lib/types/membership';
import { createLogger } from '$lib/server/utils/logger';

const logger = createLogger({ module: 'create-order' });

export const POST: RequestHandler = async ({ locals }) => {
	// Verify user is authenticated
	const user = locals.user;
	if (!user) {
		throw error(401, 'Non autorizzato');
	}

	try {
		// Get membership summary to check state
		const summary = await getMembershipSummary(user.id);

		// Check if user already has active membership or payment in progress
		if (summary.systemState === SystemState.S5_ACTIVE) {
			throw error(400, 'Hai già una tessera attiva');
		}

		if (summary.systemState === SystemState.S4_AWAITING_NUMBER) {
			throw error(400, 'Il pagamento è già stato completato');
		}

		if (summary.systemState === SystemState.S2_PROCESSING_PAYMENT) {
			throw error(400, 'Hai già un pagamento in corso');
		}

		// Check if profile is complete
		if (!summary.profileComplete) {
			throw error(400, 'Completa il profilo prima di procedere al pagamento');
		}

		// Get membership fee
		const fee = await getMembershipFee();

		// Find or create pending membership
		let membership = await prisma.membership.findFirst({
			where: {
				userId: user.id,
				paymentStatus: 'PENDING',
				paymentProviderId: null
			},
			orderBy: { createdAt: 'desc' }
		});

		if (!membership) {
			// Create new membership for payment
			membership = await createMembershipForPayment(user.id);
		}

		// Create PayPal order
		const { orderId, approvalUrl } = await createPayPalOrder(fee, membership.id);

		// Update membership with PayPal order ID
		await prisma.membership.update({
			where: { id: membership.id },
			data: { paymentProviderId: orderId }
		});

		logger.info(
			{ userId: user.id, membershipId: membership.id, orderId },
			'PayPal order created'
		);

		return json({
			orderId,
			approvalUrl
		});
	} catch (err) {
		// Re-throw SvelteKit errors
		if (err && typeof err === 'object' && 'status' in err) {
			throw err;
		}

		logger.error({ err, userId: user.id }, 'Failed to create PayPal order');
		throw error(500, 'Errore nella creazione del pagamento. Riprova più tardi.');
	}
};
