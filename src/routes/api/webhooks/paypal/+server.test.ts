/**
 * Tests for PayPal Webhook Handler
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PaymentStatus, MembershipStatus } from '@prisma/client';

// Mock environment variables
vi.mock('$env/static/private', () => ({
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
		findFirst: vi.fn()
	},
	paymentLog: {
		create: vi.fn()
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

// Import after mocks
const { POST } = await import('./+server');

describe('PayPal Webhook Handler', () => {
	beforeEach(() => {
		vi.clearAllMocks();
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
			const request = createMockRequest({ event_type: 'UNKNOWN' }, { 'x-paypal-signature': 'test' });

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

	describe('Event Routing', () => {
		beforeEach(() => {
			mockVerifyPayPalWebhook.mockResolvedValue(true);
			mockPrisma.membership.update.mockResolvedValue({});
			mockPrisma.membership.findFirst.mockResolvedValue({ id: 'membership-123' });
			mockPrisma.paymentLog.create.mockResolvedValue({});
		});

		it('should route CHECKOUT.ORDER.APPROVED event', async () => {
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

			expect(response.status).toBe(200);
			expect(data).toEqual({ success: true });
			expect(mockPaymentLogger.info).toHaveBeenCalledWith('Processing PayPal webhook: CHECKOUT.ORDER.APPROVED');
		});

		it('should route PAYMENT.CAPTURE.COMPLETED event', async () => {
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
			expect(mockPaymentLogger.info).toHaveBeenCalledWith('Processing PayPal webhook: PAYMENT.CAPTURE.COMPLETED');
		});

		it('should route PAYMENT.CAPTURE.DENIED event', async () => {
			const event = {
				event_type: 'PAYMENT.CAPTURE.DENIED',
				resource: {
					supplementary_data: { related_ids: { order_id: 'ORDER-123' } }
				}
			};
			const request = createMockRequest(event);

			const response = await POST({ request } as any);

			expect(response.status).toBe(200);
		});

		it('should route PAYMENT.CAPTURE.DECLINED event', async () => {
			const event = {
				event_type: 'PAYMENT.CAPTURE.DECLINED',
				resource: {
					supplementary_data: { related_ids: { order_id: 'ORDER-123' } }
				}
			};
			const request = createMockRequest(event);

			const response = await POST({ request } as any);

			expect(response.status).toBe(200);
		});

		it('should route PAYMENT.CAPTURE.REFUNDED event', async () => {
			const event = {
				event_type: 'PAYMENT.CAPTURE.REFUNDED',
				resource: {
					supplementary_data: { related_ids: { order_id: 'ORDER-123' } }
				}
			};
			const request = createMockRequest(event);

			const response = await POST({ request } as any);

			expect(response.status).toBe(200);
		});

		it('should log warning for unknown event types', async () => {
			const event = { event_type: 'UNKNOWN.EVENT.TYPE' };
			const request = createMockRequest(event);

			const response = await POST({ request } as any);
			const data = await response.json();

			expect(response.status).toBe(200);
			expect(data).toEqual({ success: true });
			expect(mockPaymentLogger.warn).toHaveBeenCalledWith('Unhandled webhook event type: UNKNOWN.EVENT.TYPE');
		});
	});

	describe('handleOrderApproved', () => {
		beforeEach(() => {
			mockVerifyPayPalWebhook.mockResolvedValue(true);
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

		it('should create payment log entry', async () => {
			const event = {
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

			expect(mockPaymentLogger.info).toHaveBeenCalledWith('Order approved: ORDER-123 for membership: membership-456');
		});
	});

	describe('handlePaymentCompleted', () => {
		beforeEach(() => {
			mockVerifyPayPalWebhook.mockResolvedValue(true);
			mockPrisma.membership.findFirst.mockResolvedValue({ id: 'membership-123' });
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
					status: MembershipStatus.ACTIVE,
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

		it('should update membership status to SUCCEEDED and ACTIVE', async () => {
			const event = {
				event_type: 'PAYMENT.CAPTURE.COMPLETED',
				resource: {
					id: 'CAPTURE-123',
					amount: { value: '30.00' },
					supplementary_data: { related_ids: { order_id: 'ORDER-123' } }
				}
			};
			const request = createMockRequest(event);

			await POST({ request } as any);

			expect(mockPrisma.membership.update).toHaveBeenCalledWith({
				where: { id: 'membership-123' },
				data: {
					paymentStatus: PaymentStatus.SUCCEEDED,
					status: MembershipStatus.ACTIVE,
					paymentAmount: 3000
				}
			});
		});

		it('should handle missing order ID', async () => {
			const event = {
				event_type: 'PAYMENT.CAPTURE.COMPLETED',
				resource: {
					id: 'CAPTURE-123',
					amount: { value: '25.00' },
					supplementary_data: {} // No order_id
				}
			};
			const request = createMockRequest(event);

			await POST({ request } as any);

			expect(mockPaymentLogger.error).toHaveBeenCalledWith('No order ID in payment capture event');
			expect(mockPrisma.membership.findFirst).not.toHaveBeenCalled();
		});

		it('should handle membership not found', async () => {
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

			await POST({ request } as any);

			expect(mockPaymentLogger.error).toHaveBeenCalledWith('Membership not found for PayPal order: ORDER-NOTFOUND');
			expect(mockPrisma.membership.update).not.toHaveBeenCalled();
		});

		it('should create payment log', async () => {
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

			expect(mockPrisma.paymentLog.create).toHaveBeenCalledWith({
				data: {
					membershipId: 'membership-123',
					eventType: 'PAYMENT.CAPTURE.COMPLETED',
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

			expect(mockPaymentLogger.info).toHaveBeenCalledWith('Payment completed for membership: membership-123');
		});
	});

	describe('handlePaymentFailed', () => {
		beforeEach(() => {
			mockVerifyPayPalWebhook.mockResolvedValue(true);
			mockPrisma.membership.findFirst.mockResolvedValue({ id: 'membership-123' });
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

		it('should handle missing order ID', async () => {
			const event = {
				event_type: 'PAYMENT.CAPTURE.DENIED',
				resource: {
					supplementary_data: {}
				}
			};
			const request = createMockRequest(event);

			await POST({ request } as any);

			expect(mockPaymentLogger.error).toHaveBeenCalledWith('No order ID in payment failed event');
			expect(mockPrisma.membership.findFirst).not.toHaveBeenCalled();
		});

		it('should handle membership not found', async () => {
			mockPrisma.membership.findFirst.mockResolvedValue(null);
			const event = {
				event_type: 'PAYMENT.CAPTURE.DENIED',
				resource: {
					supplementary_data: { related_ids: { order_id: 'ORDER-NOTFOUND' } }
				}
			};
			const request = createMockRequest(event);

			await POST({ request } as any);

			expect(mockPaymentLogger.error).toHaveBeenCalledWith('Membership not found for PayPal order: ORDER-NOTFOUND');
		});

		it('should create payment log with event type', async () => {
			const event = {
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

			expect(mockPaymentLogger.warn).toHaveBeenCalledWith('Payment failed for membership: membership-123');
		});
	});

	describe('handlePaymentRefunded', () => {
		beforeEach(() => {
			mockVerifyPayPalWebhook.mockResolvedValue(true);
			mockPrisma.membership.findFirst.mockResolvedValue({ id: 'membership-123' });
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

		it('should handle missing order ID', async () => {
			const event = {
				event_type: 'PAYMENT.CAPTURE.REFUNDED',
				resource: {
					supplementary_data: {}
				}
			};
			const request = createMockRequest(event);

			await POST({ request } as any);

			expect(mockPaymentLogger.error).toHaveBeenCalledWith('No order ID in payment refund event');
			expect(mockPrisma.membership.findFirst).not.toHaveBeenCalled();
		});

		it('should handle membership not found', async () => {
			mockPrisma.membership.findFirst.mockResolvedValue(null);
			const event = {
				event_type: 'PAYMENT.CAPTURE.REFUNDED',
				resource: {
					supplementary_data: { related_ids: { order_id: 'ORDER-NOTFOUND' } }
				}
			};
			const request = createMockRequest(event);

			await POST({ request } as any);

			expect(mockPaymentLogger.error).toHaveBeenCalledWith('Membership not found for PayPal order: ORDER-NOTFOUND');
		});

		it('should create payment log', async () => {
			const event = {
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

			expect(mockPaymentLogger.info).toHaveBeenCalledWith('Payment refunded for membership: membership-123');
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
			expect(mockPaymentLogger.error).toHaveBeenCalledWith('PayPal webhook error:', expect.any(Error));
		});

		it('should handle database errors', async () => {
			mockPrisma.membership.update.mockRejectedValue(new Error('DB error'));
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
			mockPrisma.membership.findFirst.mockResolvedValue({ id: 'membership-123' });
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

			await POST({ request } as any);

			expect(mockPaymentLogger.error).toHaveBeenCalledWith('No order ID in payment capture event');
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

			await POST({ request } as any);

			expect(mockPaymentLogger.error).toHaveBeenCalledWith('No order ID in payment capture event');
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
