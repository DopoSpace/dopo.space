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
import { PaymentStatus, MembershipStatus, type Membership } from '@prisma/client';
import { PAYPAL_WEBHOOK_ID } from '$env/static/private';
import { paymentLogger } from '$lib/server/utils/logger';

/**
 * Allowed webhook event types (whitelist for security)
 */
const ALLOWED_EVENT_TYPES = new Set([
	'CHECKOUT.ORDER.APPROVED',
	'PAYMENT.CAPTURE.COMPLETED',
	'PAYMENT.CAPTURE.DENIED',
	'PAYMENT.CAPTURE.DECLINED',
	'PAYMENT.CAPTURE.REFUNDED'
]);

/**
 * Maximum allowed body size for webhook payloads (1MB)
 * Prevents denial-of-service attacks via oversized payloads
 */
const MAX_BODY_SIZE = 1024 * 1024; // 1MB

export const POST: RequestHandler = async ({ request }) => {
	try {
		// Check Content-Length to prevent oversized payloads
		const contentLength = request.headers.get('content-length');
		if (contentLength) {
			const size = parseInt(contentLength, 10);
			if (!isNaN(size) && size > MAX_BODY_SIZE) {
				paymentLogger.warn({ contentLength: size, maxAllowed: MAX_BODY_SIZE }, 'Webhook payload too large');
				return json({ error: 'Payload too large' }, { status: 413 });
			}
		}

		// Get webhook headers and body
		const headers: Record<string, string> = {};
		request.headers.forEach((value, key) => {
			headers[key] = value;
		});

		const body = await request.text();

		// Double-check actual body size (Content-Length can be spoofed)
		if (body.length > MAX_BODY_SIZE) {
			paymentLogger.warn({ actualSize: body.length, maxAllowed: MAX_BODY_SIZE }, 'Webhook payload too large (actual)');
			return json({ error: 'Payload too large' }, { status: 413 });
		}

		// Verify webhook signature for security
		const isValid = await verifyPayPalWebhook(PAYPAL_WEBHOOK_ID, headers, body);

		if (!isValid) {
			paymentLogger.error('Invalid PayPal webhook signature');
			return json({ error: 'Invalid signature' }, { status: 401 });
		}

		// Parse webhook event
		const event = JSON.parse(body);
		const eventType = event.event_type;
		const providerEventId = event.id; // PayPal's unique event ID for idempotency

		paymentLogger.info({ eventType, providerEventId }, 'Processing PayPal webhook');

		// Reject unexpected event types after signature verification
		if (!ALLOWED_EVENT_TYPES.has(eventType)) {
			paymentLogger.warn({ eventType }, 'Unexpected webhook event type');
			return json({ error: 'Unexpected event type' }, { status: 400 });
		}

		// Early idempotency check using PayPal event ID
		if (await isEventAlreadyProcessed(providerEventId)) {
			paymentLogger.info({ providerEventId, eventType }, 'Webhook event already processed, returning success');
			return json({ success: true, duplicate: true });
		}

		// Handle different webhook events
		switch (eventType) {
			case 'CHECKOUT.ORDER.APPROVED':
				await handleOrderApproved(event, providerEventId);
				break;

			case 'PAYMENT.CAPTURE.COMPLETED':
				await handlePaymentCompleted(event, providerEventId);
				break;

			case 'PAYMENT.CAPTURE.DENIED':
			case 'PAYMENT.CAPTURE.DECLINED':
				await handlePaymentFailed(event, providerEventId);
				break;

			case 'PAYMENT.CAPTURE.REFUNDED':
				await handlePaymentRefunded(event, providerEventId);
				break;

			default:
				// This should never happen if ALLOWED_EVENT_TYPES is in sync with switch cases
				// Log warning for defensive monitoring
				paymentLogger.warn({ eventType }, 'Whitelisted event type has no handler');
				break;
		}

		return json({ success: true });
	} catch (error) {
		paymentLogger.error({ err: error }, 'PayPal webhook error');
		return json({ error: 'Webhook processing failed' }, { status: 500 });
	}
};

/**
 * Helper to get membership by PayPal order ID with validation
 * Returns membership or throws error (to trigger webhook retry)
 */
async function getMembershipByOrderId(
	orderId: string | undefined,
	eventType: string
): Promise<Membership | null> {
	if (!orderId) {
		paymentLogger.error({ eventType }, 'No order ID in webhook event');
		return null;
	}

	const membership = await prisma.membership.findFirst({
		where: { paymentProviderId: orderId }
	});

	if (!membership) {
		paymentLogger.error({ orderId, eventType }, 'Membership not found for PayPal order');
		return null;
	}

	return membership;
}

/**
 * Check if payment event was already processed (idempotency)
 * Uses PayPal's unique event ID for precise deduplication
 */
async function isEventAlreadyProcessed(providerEventId: string | undefined): Promise<boolean> {
	if (!providerEventId) {
		// No event ID provided, cannot check idempotency by event ID
		return false;
	}

	const existingLog = await prisma.paymentLog.findFirst({
		where: { providerEventId }
	});

	return !!existingLog;
}

/**
 * Create payment log with idempotency handling
 * Returns true if created, false if already exists (duplicate event)
 */
async function createPaymentLogIdempotent(
	membershipId: string,
	eventType: string,
	providerEventId: string | undefined,
	providerResponse: unknown
): Promise<boolean> {
	try {
		await prisma.paymentLog.create({
			data: {
				membershipId,
				eventType,
				providerEventId,
				providerResponse: providerResponse as any
			}
		});
		return true;
	} catch (error) {
		// Check for unique constraint violation (P2002)
		if (
			error &&
			typeof error === 'object' &&
			'code' in error &&
			error.code === 'P2002'
		) {
			paymentLogger.info({ membershipId, eventType, providerEventId }, 'Duplicate webhook event, skipping');
			return false;
		}
		throw error;
	}
}

/**
 * Handle CHECKOUT.ORDER.APPROVED event
 */
async function handleOrderApproved(event: any, providerEventId: string | undefined) {
	const orderId = event.resource?.id;
	const membershipId = event.resource?.purchase_units?.[0]?.reference_id;

	if (!orderId || !membershipId) {
		paymentLogger.error('Missing orderId or membershipId in CHECKOUT.ORDER.APPROVED');
		throw new Error('Invalid webhook payload: missing required fields');
	}

	// Validate membership exists before updating
	const membership = await prisma.membership.findUnique({
		where: { id: membershipId }
	});

	if (!membership) {
		paymentLogger.error({ membershipId }, 'Membership not found for order approval');
		throw new Error(`Membership not found: ${membershipId}`);
	}

	paymentLogger.info({ orderId, membershipId }, 'Order approved');

	// Update membership with PayPal order ID
	await prisma.membership.update({
		where: { id: membershipId },
		data: {
			paymentProviderId: orderId
		}
	});

	// Log the event with idempotency handling
	await createPaymentLogIdempotent(membershipId, 'CHECKOUT.ORDER.APPROVED', providerEventId, event);
}

/**
 * Handle PAYMENT.CAPTURE.COMPLETED event
 */
async function handlePaymentCompleted(event: any, providerEventId: string | undefined) {
	const captureId = event.resource?.id;
	const amount = parseFloat(event.resource?.amount?.value || '0') * 100; // Convert to cents
	const orderId = event.resource?.supplementary_data?.related_ids?.order_id;

	const membership = await getMembershipByOrderId(orderId, 'PAYMENT.CAPTURE.COMPLETED');
	if (!membership) {
		// Return error to trigger PayPal retry
		throw new Error(`Membership not found for order: ${orderId}`);
	}

	// Check if membership is already in a final state (idempotency)
	if (membership.paymentStatus === PaymentStatus.SUCCEEDED) {
		paymentLogger.info({ membershipId: membership.id }, 'Payment already marked as succeeded, skipping');
		return;
	}

	// Update membership payment status
	// Note: status stays PENDING until admin assigns card number (S4 → S5 transition)
	// startDate and endDate will be set when card is assigned
	await prisma.membership.update({
		where: { id: membership.id },
		data: {
			paymentStatus: PaymentStatus.SUCCEEDED,
			paymentAmount: Math.round(amount)
		}
	});

	// Log the event with idempotency handling
	await createPaymentLogIdempotent(membership.id, 'PAYMENT.CAPTURE.COMPLETED', providerEventId, event);

	paymentLogger.info({ membershipId: membership.id, captureId }, 'Payment completed');
}

/**
 * Handle PAYMENT.CAPTURE.DENIED or DECLINED event
 */
async function handlePaymentFailed(event: any, providerEventId: string | undefined) {
	const orderId = event.resource?.supplementary_data?.related_ids?.order_id;
	const eventType = event.event_type;

	const membership = await getMembershipByOrderId(orderId, eventType);
	if (!membership) {
		// Return error to trigger PayPal retry
		throw new Error(`Membership not found for order: ${orderId}`);
	}

	// Check if membership is already in a final state
	if (membership.paymentStatus === PaymentStatus.FAILED) {
		paymentLogger.info({ membershipId: membership.id }, 'Payment already marked as failed, skipping');
		return;
	}

	// Update membership status
	await prisma.membership.update({
		where: { id: membership.id },
		data: {
			paymentStatus: PaymentStatus.FAILED
		}
	});

	// Log the event with idempotency handling
	await createPaymentLogIdempotent(membership.id, eventType, providerEventId, event);

	paymentLogger.warn({ membershipId: membership.id, eventType }, 'Payment failed');
}

/**
 * Handle PAYMENT.CAPTURE.REFUNDED event
 */
async function handlePaymentRefunded(event: any, providerEventId: string | undefined) {
	const orderId = event.resource?.supplementary_data?.related_ids?.order_id;

	const membership = await getMembershipByOrderId(orderId, 'PAYMENT.CAPTURE.REFUNDED');
	if (!membership) {
		// Return error to trigger PayPal retry
		throw new Error(`Membership not found for order: ${orderId}`);
	}

	// Check if membership is already canceled
	if (membership.paymentStatus === PaymentStatus.CANCELED) {
		paymentLogger.info({ membershipId: membership.id }, 'Payment already marked as canceled, skipping');
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

	// Log the event with idempotency handling
	await createPaymentLogIdempotent(membership.id, 'PAYMENT.CAPTURE.REFUNDED', providerEventId, event);

	paymentLogger.info({ membershipId: membership.id }, 'Payment refunded');
}
