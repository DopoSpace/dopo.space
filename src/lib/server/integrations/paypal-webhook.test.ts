/**
 * Tests for PayPal Webhook Handler
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PaymentStatus, MembershipStatus } from '@prisma/client';

// Mock environment variables
vi.mock('$env/static/private', () => ({
	JWT_SECRET: 'test-jwt-secret-at-least-32-characters-long',
	DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
	APP_URL: 'http://localhost:5173',
	MAIN_DOMAIN: 'lvh.me:5173',
	ADMIN_SUBDOMAIN: 'admin',
	PAYPAL_CLIENT_ID: 'test-client-id',
	PAYPAL_CLIENT_SECRET: 'test-client-secret',
	PAYPAL_MODE: 'sandbox',
	PAYPAL_WEBHOOK_ID: 'test-webhook-id'
}));

// Mock PayPal verification
const mockVerifyPayPalWebhook = vi.fn();
vi.mock('$lib/server/integrations/paypal', () => ({
	verifyPayPalWebhook: mockVerifyPayPalWebhook
}));

// Mock Prisma
const mockPrisma = {
	membership: {
		update: vi.fn(),
		findFirst: vi.fn(),
		findUnique: vi.fn()
	},
	paymentLog: {
		create: vi.fn(),
		findFirst: vi.fn()
	}
};

vi.mock('$lib/server/db/prisma', () => ({
	prisma: mockPrisma
}));

// Mock logger
const mockPaymentLogger = {
	info: vi.fn(),
	error: vi.fn(),
	warn: vi.fn()
};

vi.mock('$lib/server/utils/logger', () => ({
	paymentLogger: mockPaymentLogger
}));

// Mock email mailer
const mockSendPaymentConfirmationEmail = vi.fn();
vi.mock('$lib/server/email/mailer', () => ({
	sendPaymentConfirmationEmail: mockSendPaymentConfirmationEmail
}));

// Import after mocks - updated path to route
const { POST } = await import('../../../routes/api/webhooks/paypal/+server');

describe('PayPal Webhook Handler', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		// Default: no idempotency issues (event not processed yet)
		mockPrisma.paymentLog.findFirst.mockResolvedValue(null);
	});

	// Helper to create mock request
	const createMockRequest = (body: any, headers: Record<string, string> = {}) => {
		const headersMap = new Map(Object.entries(headers));
		return {
			headers: headersMap,
			text: vi.fn().mockResolvedValue(JSON.stringify(body))
		} as any;
	};

	describe('POST Handler - Security', () => {
		it('should verify webhook signature', async () => {
			mockVerifyPayPalWebhook.mockResolvedValue(true);
			mockPrisma.membership.findUnique.mockResolvedValue({ id: 'membership-123' });
			const request = createMockRequest({
				event_type: 'CHECKOUT.ORDER.APPROVED',
				resource: { id: 'ORDER-123', purchase_units: [{ reference_id: 'membership-123' }] }
			}, { 'x-paypal-signature': 'test' });

			await POST({ request } as any);

			expect(mockVerifyPayPalWebhook).toHaveBeenCalledWith(
				'test-webhook-id',
				expect.objectContaining({ 'x-paypal-signature': 'test' }),
				expect.any(String)
			);
		});

		it('should return 401 for invalid signature', async () => {
			mockVerifyPayPalWebhook.mockResolvedValue(false);
			const request = createMockRequest({ event_type: 'UNKNOWN' });

			const response = await POST({ request } as any);
			const data = await response.json();

			expect(response.status).toBe(401);
			expect(data).toEqual({ error: 'Invalid signature' });
			expect(mockPaymentLogger.error).toHaveBeenCalledWith('Invalid PayPal webhook signature');
		});

		it('should handle verification errors', async () => {
			mockVerifyPayPalWebhook.mockRejectedValue(new Error('Verification failed'));
			const request = createMockRequest({ event_type: 'UNKNOWN' });

			const response = await POST({ request } as any);
			const data = await response.json();

			expect(response.status).toBe(500);
			expect(data).toEqual({ error: 'Webhook processing failed' });
		});
	});

	describe('Event Type Whitelist', () => {
		beforeEach(() => {
			mockVerifyPayPalWebhook.mockResolvedValue(true);
		});

		it('should reject unexpected event types with 400', async () => {
			const event = { event_type: 'UNKNOWN.EVENT.TYPE' };
			const request = createMockRequest(event);

			const response = await POST({ request } as any);
			const data = await response.json();

			expect(response.status).toBe(400);
			expect(data).toEqual({ error: 'Unexpected event type' });
			expect(mockPaymentLogger.warn).toHaveBeenCalledWith(
				{ eventType: 'UNKNOWN.EVENT.TYPE' },
				'Unexpected webhook event type'
			);
		});

		it('should accept CHECKOUT.ORDER.APPROVED', async () => {
			mockPrisma.membership.findUnique.mockResolvedValue({ id: 'membership-123' });
			const event = {
				event_type: 'CHECKOUT.ORDER.APPROVED',
				resource: { id: 'ORDER-123', purchase_units: [{ reference_id: 'membership-123' }] }
			};
			const request = createMockRequest(event);

			const response = await POST({ request } as any);

			expect(response.status).toBe(200);
		});

		it('should accept PAYMENT.CAPTURE.COMPLETED', async () => {
			mockPrisma.membership.findFirst.mockResolvedValue({ id: 'membership-123', paymentStatus: 'PENDING' });
			const event = {
				event_type: 'PAYMENT.CAPTURE.COMPLETED',
				resource: {
					id: 'CAPTURE-123',
					amount: { value: '25.00' },
					supplementary_data: { related_ids: { order_id: 'ORDER-123' } }
				}
			};
			const request = createMockRequest(event);

			const response = await POST({ request } as any);

			expect(response.status).toBe(200);
		});
	});

	describe('handleOrderApproved', () => {
		beforeEach(() => {
			mockVerifyPayPalWebhook.mockResolvedValue(true);
			mockPrisma.membership.findUnique.mockResolvedValue({ id: 'membership-456' });
			mockPrisma.membership.update.mockResolvedValue({});
			mockPrisma.paymentLog.create.mockResolvedValue({});
		});

		it('should update membership with order ID', async () => {
			const event = {
				event_type: 'CHECKOUT.ORDER.APPROVED',
				resource: {
					id: 'ORDER-123',
					purchase_units: [{ reference_id: 'membership-456' }]
				}
			};
			const request = createMockRequest(event);

			await POST({ request } as any);

			expect(mockPrisma.membership.update).toHaveBeenCalledWith({
				where: { id: 'membership-456' },
				data: { paymentProviderId: 'ORDER-123' }
			});
		});

		it('should validate membership exists before updating', async () => {
			const event = {
				event_type: 'CHECKOUT.ORDER.APPROVED',
				resource: {
					id: 'ORDER-123',
					purchase_units: [{ reference_id: 'membership-456' }]
				}
			};
			const request = createMockRequest(event);

			await POST({ request } as any);

			expect(mockPrisma.membership.findUnique).toHaveBeenCalledWith({
				where: { id: 'membership-456' }
			});
		});

		it('should throw error if membership not found', async () => {
			mockPrisma.membership.findUnique.mockResolvedValue(null);
			const event = {
				event_type: 'CHECKOUT.ORDER.APPROVED',
				resource: {
					id: 'ORDER-123',
					purchase_units: [{ reference_id: 'membership-notfound' }]
				}
			};
			const request = createMockRequest(event);

			const response = await POST({ request } as any);

			expect(response.status).toBe(500);
			expect(mockPaymentLogger.error).toHaveBeenCalledWith(
				{ membershipId: 'membership-notfound' },
				'Membership not found for order approval'
			);
		});

		it('should skip if event already processed (idempotency)', async () => {
			mockPrisma.paymentLog.findFirst.mockResolvedValue({ id: 'existing-log' });
			const event = {
				id: 'WH-EVENT-123', // PayPal event ID for idempotency
				event_type: 'CHECKOUT.ORDER.APPROVED',
				resource: {
					id: 'ORDER-123',
					purchase_units: [{ reference_id: 'membership-456' }]
				}
			};
			const request = createMockRequest(event);

			const response = await POST({ request } as any);
			const data = await response.json();

			expect(response.status).toBe(200);
			expect(data).toEqual({ success: true, duplicate: true });
			expect(mockPrisma.membership.update).not.toHaveBeenCalled();
			expect(mockPaymentLogger.info).toHaveBeenCalledWith(
				{ providerEventId: 'WH-EVENT-123', eventType: 'CHECKOUT.ORDER.APPROVED' },
				'Webhook event already processed, returning success'
			);
		});

		it('should create payment log entry', async () => {
			const event = {
				id: 'WH-EVENT-456', // PayPal event ID
				event_type: 'CHECKOUT.ORDER.APPROVED',
				resource: {
					id: 'ORDER-123',
					purchase_units: [{ reference_id: 'membership-456' }]
				}
			};
			const request = createMockRequest(event);

			await POST({ request } as any);

			expect(mockPrisma.paymentLog.create).toHaveBeenCalledWith({
				data: {
					membershipId: 'membership-456',
					eventType: 'CHECKOUT.ORDER.APPROVED',
					providerEventId: 'WH-EVENT-456',
					providerResponse: event
				}
			});
		});

		it('should log success message', async () => {
			const event = {
				event_type: 'CHECKOUT.ORDER.APPROVED',
				resource: {
					id: 'ORDER-123',
					purchase_units: [{ reference_id: 'membership-456' }]
				}
			};
			const request = createMockRequest(event);

			await POST({ request } as any);

			expect(mockPaymentLogger.info).toHaveBeenCalledWith(
				{ orderId: 'ORDER-123', membershipId: 'membership-456' },
				'Order approved'
			);
		});
	});

	describe('handlePaymentCompleted', () => {
		beforeEach(() => {
			mockVerifyPayPalWebhook.mockResolvedValue(true);
			mockPrisma.membership.findFirst.mockResolvedValue({
				id: 'membership-123',
				paymentStatus: PaymentStatus.PENDING
			});
			mockPrisma.membership.update.mockResolvedValue({});
			mockPrisma.paymentLog.create.mockResolvedValue({});
		});

		it('should convert amount from euros to cents correctly', async () => {
			const event = {
				event_type: 'PAYMENT.CAPTURE.COMPLETED',
				resource: {
					id: 'CAPTURE-123',
					amount: { value: '25.50' },
					supplementary_data: { related_ids: { order_id: 'ORDER-123' } }
				}
			};
			const request = createMockRequest(event);

			await POST({ request } as any);

			expect(mockPrisma.membership.update).toHaveBeenCalledWith({
				where: { id: 'membership-123' },
				data: {
					paymentStatus: PaymentStatus.SUCCEEDED,
					paymentAmount: 2550 // 25.50 * 100
				}
			});
		});

		it('should round amount to nearest cent', async () => {
			const event = {
				event_type: 'PAYMENT.CAPTURE.COMPLETED',
				resource: {
					id: 'CAPTURE-123',
					amount: { value: '25.556' }, // Should round to 2556
					supplementary_data: { related_ids: { order_id: 'ORDER-123' } }
				}
			};
			const request = createMockRequest(event);

			await POST({ request } as any);

			expect(mockPrisma.membership.update).toHaveBeenCalledWith(
				expect.objectContaining({
					data: expect.objectContaining({
						paymentAmount: 2556
					})
				})
			);
		});

		it('should find membership by order ID', async () => {
			const event = {
				event_type: 'PAYMENT.CAPTURE.COMPLETED',
				resource: {
					id: 'CAPTURE-123',
					amount: { value: '25.00' },
					supplementary_data: { related_ids: { order_id: 'ORDER-789' } }
				}
			};
			const request = createMockRequest(event);

			await POST({ request } as any);

			expect(mockPrisma.membership.findFirst).toHaveBeenCalledWith({
				where: { paymentProviderId: 'ORDER-789' }
			});
		});

		it('should skip if payment already succeeded (idempotency)', async () => {
			mockPrisma.membership.findFirst.mockResolvedValue({
				id: 'membership-123',
				paymentStatus: PaymentStatus.SUCCEEDED
			});
			const event = {
				event_type: 'PAYMENT.CAPTURE.COMPLETED',
				resource: {
					id: 'CAPTURE-123',
					amount: { value: '25.00' },
					supplementary_data: { related_ids: { order_id: 'ORDER-123' } }
				}
			};
			const request = createMockRequest(event);

			const response = await POST({ request } as any);

			expect(response.status).toBe(200);
			expect(mockPrisma.membership.update).not.toHaveBeenCalled();
			expect(mockPaymentLogger.info).toHaveBeenCalledWith(
				{ membershipId: 'membership-123' },
				'Payment already marked as succeeded, skipping'
			);
		});

		it('should throw error for missing order ID to trigger retry', async () => {
			const event = {
				event_type: 'PAYMENT.CAPTURE.COMPLETED',
				resource: {
					id: 'CAPTURE-123',
					amount: { value: '25.00' },
					supplementary_data: {} // No order_id
				}
			};
			const request = createMockRequest(event);

			const response = await POST({ request } as any);

			expect(response.status).toBe(500);
			expect(mockPaymentLogger.error).toHaveBeenCalledWith(
				{ eventType: 'PAYMENT.CAPTURE.COMPLETED' },
				'No order ID in webhook event'
			);
		});

		it('should throw error when membership not found to trigger retry', async () => {
			mockPrisma.membership.findFirst.mockResolvedValue(null);
			const event = {
				event_type: 'PAYMENT.CAPTURE.COMPLETED',
				resource: {
					id: 'CAPTURE-123',
					amount: { value: '25.00' },
					supplementary_data: { related_ids: { order_id: 'ORDER-NOTFOUND' } }
				}
			};
			const request = createMockRequest(event);

			const response = await POST({ request } as any);

			expect(response.status).toBe(500);
			expect(mockPaymentLogger.error).toHaveBeenCalledWith(
				{ orderId: 'ORDER-NOTFOUND', eventType: 'PAYMENT.CAPTURE.COMPLETED' },
				'Membership not found for PayPal order'
			);
		});

		it('should create payment log', async () => {
			const event = {
				id: 'WH-EVENT-789',
				event_type: 'PAYMENT.CAPTURE.COMPLETED',
				resource: {
					id: 'CAPTURE-123',
					amount: { value: '25.00' },
					supplementary_data: { related_ids: { order_id: 'ORDER-123' } }
				}
			};
			const request = createMockRequest(event);

			await POST({ request } as any);

			expect(mockPrisma.paymentLog.create).toHaveBeenCalledWith({
				data: {
					membershipId: 'membership-123',
					eventType: 'PAYMENT.CAPTURE.COMPLETED',
					providerEventId: 'WH-EVENT-789',
					providerResponse: event
				}
			});
		});

		it('should log completion message', async () => {
			const event = {
				event_type: 'PAYMENT.CAPTURE.COMPLETED',
				resource: {
					id: 'CAPTURE-123',
					amount: { value: '25.00' },
					supplementary_data: { related_ids: { order_id: 'ORDER-123' } }
				}
			};
			const request = createMockRequest(event);

			await POST({ request } as any);

			expect(mockPaymentLogger.info).toHaveBeenCalledWith(
				{ membershipId: 'membership-123', captureId: 'CAPTURE-123' },
				'Payment completed'
			);
		});
	});

	describe('handlePaymentFailed', () => {
		beforeEach(() => {
			mockVerifyPayPalWebhook.mockResolvedValue(true);
			mockPrisma.membership.findFirst.mockResolvedValue({
				id: 'membership-123',
				paymentStatus: PaymentStatus.PENDING
			});
			mockPrisma.membership.update.mockResolvedValue({});
			mockPrisma.paymentLog.create.mockResolvedValue({});
		});

		it('should update payment status to FAILED', async () => {
			const event = {
				event_type: 'PAYMENT.CAPTURE.DENIED',
				resource: {
					supplementary_data: { related_ids: { order_id: 'ORDER-123' } }
				}
			};
			const request = createMockRequest(event);

			await POST({ request } as any);

			expect(mockPrisma.membership.update).toHaveBeenCalledWith({
				where: { id: 'membership-123' },
				data: {
					paymentStatus: PaymentStatus.FAILED
				}
			});
		});

		it('should handle PAYMENT.CAPTURE.DECLINED', async () => {
			const event = {
				event_type: 'PAYMENT.CAPTURE.DECLINED',
				resource: {
					supplementary_data: { related_ids: { order_id: 'ORDER-123' } }
				}
			};
			const request = createMockRequest(event);

			await POST({ request } as any);

			expect(mockPrisma.membership.update).toHaveBeenCalledWith({
				where: { id: 'membership-123' },
				data: {
					paymentStatus: PaymentStatus.FAILED
				}
			});
		});

		it('should skip if payment already failed (idempotency)', async () => {
			mockPrisma.membership.findFirst.mockResolvedValue({
				id: 'membership-123',
				paymentStatus: PaymentStatus.FAILED
			});
			const event = {
				event_type: 'PAYMENT.CAPTURE.DENIED',
				resource: {
					supplementary_data: { related_ids: { order_id: 'ORDER-123' } }
				}
			};
			const request = createMockRequest(event);

			const response = await POST({ request } as any);

			expect(response.status).toBe(200);
			expect(mockPrisma.membership.update).not.toHaveBeenCalled();
		});

		it('should create payment log with event type', async () => {
			const event = {
				id: 'WH-EVENT-DENIED',
				event_type: 'PAYMENT.CAPTURE.DENIED',
				resource: {
					supplementary_data: { related_ids: { order_id: 'ORDER-123' } }
				}
			};
			const request = createMockRequest(event);

			await POST({ request } as any);

			expect(mockPrisma.paymentLog.create).toHaveBeenCalledWith({
				data: {
					membershipId: 'membership-123',
					eventType: 'PAYMENT.CAPTURE.DENIED',
					providerEventId: 'WH-EVENT-DENIED',
					providerResponse: event
				}
			});
		});

		it('should log warning message', async () => {
			const event = {
				event_type: 'PAYMENT.CAPTURE.DENIED',
				resource: {
					supplementary_data: { related_ids: { order_id: 'ORDER-123' } }
				}
			};
			const request = createMockRequest(event);

			await POST({ request } as any);

			expect(mockPaymentLogger.warn).toHaveBeenCalledWith(
				{ membershipId: 'membership-123', eventType: 'PAYMENT.CAPTURE.DENIED' },
				'Payment failed'
			);
		});
	});

	describe('handlePaymentRefunded', () => {
		beforeEach(() => {
			mockVerifyPayPalWebhook.mockResolvedValue(true);
			mockPrisma.membership.findFirst.mockResolvedValue({
				id: 'membership-123',
				paymentStatus: PaymentStatus.SUCCEEDED
			});
			mockPrisma.membership.update.mockResolvedValue({});
			mockPrisma.paymentLog.create.mockResolvedValue({});
		});

		it('should update status to CANCELED and EXPIRED', async () => {
			const event = {
				event_type: 'PAYMENT.CAPTURE.REFUNDED',
				resource: {
					supplementary_data: { related_ids: { order_id: 'ORDER-123' } }
				}
			};
			const request = createMockRequest(event);

			await POST({ request } as any);

			expect(mockPrisma.membership.update).toHaveBeenCalledWith({
				where: { id: 'membership-123' },
				data: {
					paymentStatus: PaymentStatus.CANCELED,
					status: MembershipStatus.EXPIRED
				}
			});
		});

		it('should skip if payment already canceled (idempotency)', async () => {
			mockPrisma.membership.findFirst.mockResolvedValue({
				id: 'membership-123',
				paymentStatus: PaymentStatus.CANCELED
			});
			const event = {
				event_type: 'PAYMENT.CAPTURE.REFUNDED',
				resource: {
					supplementary_data: { related_ids: { order_id: 'ORDER-123' } }
				}
			};
			const request = createMockRequest(event);

			const response = await POST({ request } as any);

			expect(response.status).toBe(200);
			expect(mockPrisma.membership.update).not.toHaveBeenCalled();
		});

		it('should create payment log', async () => {
			const event = {
				id: 'WH-EVENT-REFUND',
				event_type: 'PAYMENT.CAPTURE.REFUNDED',
				resource: {
					supplementary_data: { related_ids: { order_id: 'ORDER-123' } }
				}
			};
			const request = createMockRequest(event);

			await POST({ request } as any);

			expect(mockPrisma.paymentLog.create).toHaveBeenCalledWith({
				data: {
					membershipId: 'membership-123',
					eventType: 'PAYMENT.CAPTURE.REFUNDED',
					providerEventId: 'WH-EVENT-REFUND',
					providerResponse: event
				}
			});
		});

		it('should log info message', async () => {
			const event = {
				event_type: 'PAYMENT.CAPTURE.REFUNDED',
				resource: {
					supplementary_data: { related_ids: { order_id: 'ORDER-123' } }
				}
			};
			const request = createMockRequest(event);

			await POST({ request } as any);

			expect(mockPaymentLogger.info).toHaveBeenCalledWith(
				{ membershipId: 'membership-123' },
				'Payment refunded'
			);
		});
	});

	describe('Error Handling', () => {
		beforeEach(() => {
			mockVerifyPayPalWebhook.mockResolvedValue(true);
		});

		it('should handle JSON parse errors', async () => {
			const request = {
				headers: new Map(),
				text: vi.fn().mockResolvedValue('invalid json')
			} as any;

			const response = await POST({ request } as any);
			const data = await response.json();

			expect(response.status).toBe(500);
			expect(data).toEqual({ error: 'Webhook processing failed' });
			expect(mockPaymentLogger.error).toHaveBeenCalledWith({ err: expect.any(Error) }, 'PayPal webhook error');
		});

		it('should handle database errors', async () => {
			mockPrisma.membership.findUnique.mockRejectedValue(new Error('DB error'));
			const event = {
				event_type: 'CHECKOUT.ORDER.APPROVED',
				resource: {
					id: 'ORDER-123',
					purchase_units: [{ reference_id: 'membership-123' }]
				}
			};
			const request = createMockRequest(event);

			const response = await POST({ request } as any);
			const data = await response.json();

			expect(response.status).toBe(500);
			expect(data).toEqual({ error: 'Webhook processing failed' });
		});
	});

	describe('Edge Cases', () => {
		beforeEach(() => {
			mockVerifyPayPalWebhook.mockResolvedValue(true);
			mockPrisma.membership.findFirst.mockResolvedValue({
				id: 'membership-123',
				paymentStatus: PaymentStatus.PENDING
			});
			mockPrisma.membership.update.mockResolvedValue({});
			mockPrisma.paymentLog.create.mockResolvedValue({});
		});

		it('should handle event with missing supplementary_data', async () => {
			const event = {
				event_type: 'PAYMENT.CAPTURE.COMPLETED',
				resource: {
					id: 'CAPTURE-123',
					amount: { value: '25.00' }
					// No supplementary_data
				}
			};
			const request = createMockRequest(event);

			const response = await POST({ request } as any);

			expect(response.status).toBe(500); // Throws error to trigger retry
		});

		it('should handle event with null related_ids', async () => {
			const event = {
				event_type: 'PAYMENT.CAPTURE.COMPLETED',
				resource: {
					id: 'CAPTURE-123',
					amount: { value: '25.00' },
					supplementary_data: { related_ids: null }
				}
			};
			const request = createMockRequest(event);

			const response = await POST({ request } as any);

			expect(response.status).toBe(500); // Throws error to trigger retry
		});

		it('should handle very large payment amounts', async () => {
			const event = {
				event_type: 'PAYMENT.CAPTURE.COMPLETED',
				resource: {
					id: 'CAPTURE-123',
					amount: { value: '9999.99' },
					supplementary_data: { related_ids: { order_id: 'ORDER-123' } }
				}
			};
			const request = createMockRequest(event);

			await POST({ request } as any);

			expect(mockPrisma.membership.update).toHaveBeenCalledWith(
				expect.objectContaining({
					data: expect.objectContaining({
						paymentAmount: 999999
					})
				})
			);
		});

		it('should handle zero payment amounts', async () => {
			const event = {
				event_type: 'PAYMENT.CAPTURE.COMPLETED',
				resource: {
					id: 'CAPTURE-123',
					amount: { value: '0.00' },
					supplementary_data: { related_ids: { order_id: 'ORDER-123' } }
				}
			};
			const request = createMockRequest(event);

			await POST({ request } as any);

			expect(mockPrisma.membership.update).toHaveBeenCalledWith(
				expect.objectContaining({
					data: expect.objectContaining({
						paymentAmount: 0
					})
				})
			);
		});
	});
});
