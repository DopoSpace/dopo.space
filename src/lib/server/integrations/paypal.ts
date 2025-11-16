/**
 * PayPal Integration
 *
 * Handles PayPal payment processing using PayPal REST API v2.
 * Documentation: https://developer.paypal.com/docs/api/orders/v2/
 */

import {
	PAYPAL_CLIENT_ID,
	PAYPAL_CLIENT_SECRET,
	PAYPAL_MODE,
	APP_URL
} from '$env/static/private';
import { paymentLogger } from '$lib/server/utils/logger';

const PAYPAL_API_BASE =
	PAYPAL_MODE === 'live'
		? 'https://api-m.paypal.com'
		: 'https://api-m.sandbox.paypal.com';

interface PayPalAccessTokenResponse {
	access_token: string;
	token_type: string;
	expires_in: number;
}

interface PayPalOrderResponse {
	id: string;
	status: string;
	links: Array<{ href: string; rel: string; method: string }>;
}

/**
 * Get PayPal OAuth access token
 */
async function getAccessToken(): Promise<string> {
	const auth = Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`).toString('base64');

	const response = await fetch(`${PAYPAL_API_BASE}/v1/oauth2/token`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/x-www-form-urlencoded',
			Authorization: `Basic ${auth}`
		},
		body: 'grant_type=client_credentials'
	});

	if (!response.ok) {
		const error = await response.text();
		throw new Error(`PayPal auth failed: ${error}`);
	}

	const data: PayPalAccessTokenResponse = await response.json();
	return data.access_token;
}

/**
 * Create a PayPal order for membership payment
 * @param amount - Amount in cents (e.g., 2500 for €25.00)
 * @param membershipId - Membership ID for reference
 * @returns PayPal order ID and approval URL
 */
export async function createPayPalOrder(
	amount: number,
	membershipId: string
): Promise<{ orderId: string; approvalUrl: string }> {
	const accessToken = await getAccessToken();

	// Convert cents to euros with 2 decimal places
	const amountInEuros = (amount / 100).toFixed(2);

	const orderData = {
		intent: 'CAPTURE',
		purchase_units: [
			{
				reference_id: membershipId,
				description: 'Dopo Space Membership',
				amount: {
					currency_code: 'EUR',
					value: amountInEuros
				}
			}
		],
		application_context: {
			brand_name: 'Dopo Space',
			landing_page: 'NO_PREFERENCE',
			user_action: 'PAY_NOW',
			return_url: `${APP_URL}/membership/payment/success`,
			cancel_url: `${APP_URL}/membership/payment/cancel`
		}
	};

	const response = await fetch(`${PAYPAL_API_BASE}/v2/checkout/orders`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${accessToken}`
		},
		body: JSON.stringify(orderData)
	});

	if (!response.ok) {
		const error = await response.text();
		throw new Error(`Failed to create PayPal order: ${error}`);
	}

	const order: PayPalOrderResponse = await response.json();

	// Find the approval URL
	const approvalLink = order.links.find((link) => link.rel === 'approve');
	if (!approvalLink) {
		throw new Error('No approval URL in PayPal response');
	}

	return {
		orderId: order.id,
		approvalUrl: approvalLink.href
	};
}

/**
 * Capture a PayPal order after user approval
 * @param orderId - PayPal order ID
 * @returns Capture details
 */
export async function capturePayPalOrder(orderId: string): Promise<{
	status: string;
	captureId: string;
	amount: number;
}> {
	const accessToken = await getAccessToken();

	const response = await fetch(`${PAYPAL_API_BASE}/v2/checkout/orders/${orderId}/capture`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${accessToken}`
		}
	});

	if (!response.ok) {
		const error = await response.text();
		throw new Error(`Failed to capture PayPal order: ${error}`);
	}

	const captureData = await response.json();

	// Extract capture details
	const purchase = captureData.purchase_units[0];
	const capture = purchase.payments.captures[0];

	return {
		status: capture.status,
		captureId: capture.id,
		amount: Math.round(parseFloat(capture.amount.value) * 100) // Convert to cents
	};
}

/**
 * Get PayPal order details
 * @param orderId - PayPal order ID
 * @returns Order details
 */
export async function getPayPalOrderDetails(orderId: string): Promise<{
	id: string;
	status: string;
	amount: number;
	currency: string;
}> {
	const accessToken = await getAccessToken();

	const response = await fetch(`${PAYPAL_API_BASE}/v2/checkout/orders/${orderId}`, {
		method: 'GET',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${accessToken}`
		}
	});

	if (!response.ok) {
		const error = await response.text();
		throw new Error(`Failed to get PayPal order: ${error}`);
	}

	const order = await response.json();
	const purchase = order.purchase_units[0];

	return {
		id: order.id,
		status: order.status,
		amount: Math.round(parseFloat(purchase.amount.value) * 100), // Convert to cents
		currency: purchase.amount.currency_code
	};
}

/**
 * Verify PayPal webhook signature for security
 * Documentation: https://developer.paypal.com/api/rest/webhooks/
 */
export async function verifyPayPalWebhook(
	webhookId: string,
	headers: Record<string, string>,
	body: string
): Promise<boolean> {
	const accessToken = await getAccessToken();

	const verificationData = {
		auth_algo: headers['paypal-auth-algo'],
		cert_url: headers['paypal-cert-url'],
		transmission_id: headers['paypal-transmission-id'],
		transmission_sig: headers['paypal-transmission-sig'],
		transmission_time: headers['paypal-transmission-time'],
		webhook_id: webhookId,
		webhook_event: JSON.parse(body)
	};

	const response = await fetch(`${PAYPAL_API_BASE}/v1/notifications/verify-webhook-signature`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${accessToken}`
		},
		body: JSON.stringify(verificationData)
	});

	if (!response.ok) {
		return false;
	}

	const result = await response.json();
	return result.verification_status === 'SUCCESS';
}

/**
 * Process PayPal webhook event
 */
export async function processPayPalWebhook(event: any): Promise<void> {
	const eventType = event.event_type;

	switch (eventType) {
		case 'PAYMENT.CAPTURE.COMPLETED':
			// Handle successful payment
			paymentLogger.info('Payment captured:', event.resource.id);
			break;

		case 'PAYMENT.CAPTURE.DENIED':
		case 'PAYMENT.CAPTURE.DECLINED':
			// Handle failed payment
			paymentLogger.warn('Payment failed:', event.resource.id);
			break;

		default:
			paymentLogger.warn('Unhandled webhook event:', eventType);
	}
}
