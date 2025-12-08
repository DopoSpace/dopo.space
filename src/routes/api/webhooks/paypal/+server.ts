/**
 * PayPal Webhook Handler
 *
 * Handles PayPal IPN (Instant Payment Notification) webhooks
 * Documentation: https://developer.paypal.com/api/rest/webhooks/
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { verifyPayPalWebhook } from '$lib/server/integrations/paypal';
import { prisma } from '$lib/server/db/prisma';
import { PaymentStatus, MembershipStatus } from '@prisma/client';
import { PAYPAL_WEBHOOK_ID } from '$env/static/private';
import { paymentLogger } from '$lib/server/utils/logger';

export const POST: RequestHandler = async ({ request }) => {
	try {
		// Get webhook headers and body
		const headers: Record<string, string> = {};
		request.headers.forEach((value, key) => {
			headers[key] = value;
		});

		const body = await request.text();

		// Verify webhook signature for security
		const isValid = await verifyPayPalWebhook(PAYPAL_WEBHOOK_ID, headers, body);

		if (!isValid) {
			paymentLogger.error('Invalid PayPal webhook signature');
			return json({ error: 'Invalid signature' }, { status: 401 });
		}

		// Parse webhook event
		const event = JSON.parse(body);
		const eventType = event.event_type;

		paymentLogger.info(`Processing PayPal webhook: ${eventType}`);

		// Handle different webhook events
		switch (eventType) {
			case 'CHECKOUT.ORDER.APPROVED':
				await handleOrderApproved(event);
				break;

			case 'PAYMENT.CAPTURE.COMPLETED':
				await handlePaymentCompleted(event);
				break;

			case 'PAYMENT.CAPTURE.DENIED':
			case 'PAYMENT.CAPTURE.DECLINED':
				await handlePaymentFailed(event);
				break;

			case 'PAYMENT.CAPTURE.REFUNDED':
				await handlePaymentRefunded(event);
				break;

			default:
				paymentLogger.warn(`Unhandled webhook event type: ${eventType}`);
		}

		return json({ success: true });
	} catch (error) {
		paymentLogger.error({ err: error }, 'PayPal webhook error');
		return json({ error: 'Webhook processing failed' }, { status: 500 });
	}
};

/**
 * Handle CHECKOUT.ORDER.APPROVED event
 */
async function handleOrderApproved(event: any) {
	const orderId = event.resource.id;
	const membershipId = event.resource.purchase_units[0].reference_id;

	paymentLogger.info(`Order approved: ${orderId} for membership: ${membershipId}`);

	// Update membership with PayPal order ID
	await prisma.membership.update({
		where: { id: membershipId },
		data: {
			paymentProviderId: orderId
		}
	});

	// Log the event
	await prisma.paymentLog.create({
		data: {
			membershipId,
			eventType: 'CHECKOUT.ORDER.APPROVED',
			providerResponse: event
		}
	});
}

/**
 * Handle PAYMENT.CAPTURE.COMPLETED event
 */
async function handlePaymentCompleted(event: any) {
	const captureId = event.resource.id;
	const amount = parseFloat(event.resource.amount.value) * 100; // Convert to cents

	// Find membership by PayPal order ID (stored in custom_id or reference_id)
	const orderId = event.resource.supplementary_data?.related_ids?.order_id;

	if (!orderId) {
		paymentLogger.error('No order ID in payment capture event');
		return;
	}

	const membership = await prisma.membership.findFirst({
		where: { paymentProviderId: orderId }
	});

	if (!membership) {
		paymentLogger.error(`Membership not found for PayPal order: ${orderId}`);
		return;
	}

	// Update membership status
	await prisma.membership.update({
		where: { id: membership.id },
		data: {
			paymentStatus: PaymentStatus.SUCCEEDED,
			status: MembershipStatus.ACTIVE,
			paymentAmount: Math.round(amount)
		}
	});

	// Log the event
	await prisma.paymentLog.create({
		data: {
			membershipId: membership.id,
			eventType: 'PAYMENT.CAPTURE.COMPLETED',
			providerResponse: event
		}
	});

	paymentLogger.info(`Payment completed for membership: ${membership.id}`);
}

/**
 * Handle PAYMENT.CAPTURE.DENIED or DECLINED event
 */
async function handlePaymentFailed(event: any) {
	const orderId = event.resource.supplementary_data?.related_ids?.order_id;

	if (!orderId) {
		paymentLogger.error('No order ID in payment failed event');
		return;
	}

	const membership = await prisma.membership.findFirst({
		where: { paymentProviderId: orderId }
	});

	if (!membership) {
		paymentLogger.error(`Membership not found for PayPal order: ${orderId}`);
		return;
	}

	// Update membership status
	await prisma.membership.update({
		where: { id: membership.id },
		data: {
			paymentStatus: PaymentStatus.FAILED
		}
	});

	// Log the event
	await prisma.paymentLog.create({
		data: {
			membershipId: membership.id,
			eventType: event.event_type,
			providerResponse: event
		}
	});

	paymentLogger.warn(`Payment failed for membership: ${membership.id}`);
}

/**
 * Handle PAYMENT.CAPTURE.REFUNDED event
 */
async function handlePaymentRefunded(event: any) {
	const orderId = event.resource.supplementary_data?.related_ids?.order_id;

	if (!orderId) {
		paymentLogger.error('No order ID in payment refund event');
		return;
	}

	const membership = await prisma.membership.findFirst({
		where: { paymentProviderId: orderId }
	});

	if (!membership) {
		paymentLogger.error(`Membership not found for PayPal order: ${orderId}`);
		return;
	}

	// Update membership status
	await prisma.membership.update({
		where: { id: membership.id },
		data: {
			paymentStatus: PaymentStatus.CANCELED,
			status: MembershipStatus.EXPIRED
		}
	});

	// Log the event
	await prisma.paymentLog.create({
		data: {
			membershipId: membership.id,
			eventType: 'PAYMENT.CAPTURE.REFUNDED',
			providerResponse: event
		}
	});

	paymentLogger.info(`Payment refunded for membership: ${membership.id}`);
}
