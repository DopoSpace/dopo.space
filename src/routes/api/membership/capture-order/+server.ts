/**
 * Capture PayPal Order API
 *
 * Captures a PayPal payment after user approval.
 * Validates that the order belongs to the authenticated user.
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { prisma } from '$lib/server/db/prisma';
import { capturePayPalOrder } from '$lib/server/integrations/paypal';
import { getMembershipFee } from '$lib/server/services/settings';
import { PaymentStatus } from '@prisma/client';
import { createLogger } from '$lib/server/utils/logger';

const logger = createLogger({ module: 'capture-order' });

export const POST: RequestHandler = async ({ request, locals }) => {
	// Verify user is authenticated
	const user = locals.user;
	if (!user) {
		throw error(401, 'Non autorizzato');
	}

	// Parse request body
	let orderId: string;
	try {
		const body = await request.json();
		orderId = body.orderId;
	} catch {
		throw error(400, 'Body della richiesta non valido');
	}

	if (!orderId || typeof orderId !== 'string') {
		throw error(400, 'orderId è richiesto');
	}

	try {
		// Find membership by PayPal order ID
		const membership = await prisma.membership.findFirst({
			where: {
				paymentProviderId: orderId,
				userId: user.id
			}
		});

		if (!membership) {
			logger.warn(
				{ userId: user.id, orderId },
				'Membership not found for order ID or does not belong to user'
			);
			throw error(404, 'Ordine non trovato');
		}

		// Check if already captured
		if (membership.paymentStatus === PaymentStatus.SUCCEEDED) {
			logger.info(
				{ membershipId: membership.id, orderId },
				'Payment already captured'
			);
			return json({
				success: true,
				alreadyCaptured: true
			});
		}

		// Capture the payment
		const capture = await capturePayPalOrder(orderId);

		if (capture.status !== 'COMPLETED') {
			logger.error(
				{ membershipId: membership.id, orderId, captureStatus: capture.status },
				'PayPal capture returned non-COMPLETED status'
			);
			throw error(400, 'Il pagamento non è stato completato');
		}

		// Validate captured amount matches expected fee (defense in depth)
		try {
			const expectedFee = await getMembershipFee();
			if (capture.amount !== expectedFee) {
				logger.warn(
					{
						membershipId: membership.id,
						orderId,
						capturedAmount: capture.amount,
						expectedFee
					},
					'Payment amount mismatch: captured amount differs from expected fee'
				);
			}
		} catch (feeErr) {
			// Non-blocking: log but don't fail the capture
			logger.warn({ feeErr, membershipId: membership.id }, 'Could not validate payment amount');
		}

		// Update membership with payment success and amount
		// Note: The webhook will also update, but this provides immediate feedback
		await prisma.membership.update({
			where: { id: membership.id },
			data: {
				paymentStatus: PaymentStatus.SUCCEEDED,
				paymentAmount: capture.amount // Amount in cents from PayPal
			}
		});

		// Log payment success
		await prisma.paymentLog.create({
			data: {
				membershipId: membership.id,
				eventType: 'CAPTURE_COMPLETED',
				providerResponse: {
					orderId,
					captureId: capture.captureId,
					amount: capture.amount,
					source: 'api'
				}
			}
		});

		logger.info(
			{ userId: user.id, membershipId: membership.id, orderId, captureId: capture.captureId },
			'PayPal payment captured successfully'
		);

		return json({
			success: true,
			captureId: capture.captureId
		});
	} catch (err) {
		// Re-throw SvelteKit errors
		if (err && typeof err === 'object' && 'status' in err) {
			throw err;
		}

		logger.error({ err, userId: user.id, orderId }, 'Failed to capture PayPal order');
		throw error(500, 'Errore nella conferma del pagamento. Riprova più tardi.');
	}
};
