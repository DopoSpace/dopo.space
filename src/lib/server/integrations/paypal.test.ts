/**
 * Tests for PayPal integration
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock environment variables
vi.mock('$env/static/private', () => ({
	PAYPAL_CLIENT_ID: 'test-client-id',
	PAYPAL_CLIENT_SECRET: 'test-client-secret',
	PAYPAL_MODE: 'sandbox',
	APP_URL: 'http://localhost:5173'
}));

// Mock fetch
global.fetch = vi.fn();

const { createPayPalOrder, capturePayPalOrder, getPayPalOrderDetails } = await import('./paypal');

describe('PayPal Integration', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe('createPayPalOrder', () => {
		it('should create a PayPal order successfully', async () => {
			// Mock OAuth token request
			(global.fetch as any).mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					access_token: 'test-token',
					token_type: 'Bearer',
					expires_in: 3600
				})
			});

			// Mock order creation request
			(global.fetch as any).mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					id: 'ORDER-123',
					status: 'CREATED',
					links: [
						{ href: 'https://paypal.com/approve', rel: 'approve', method: 'GET' },
						{ href: 'https://api.paypal.com/order/123', rel: 'self', method: 'GET' }
					]
				})
			});

			const result = await createPayPalOrder(2500, 'membership-123');

			expect(result).toEqual({
				orderId: 'ORDER-123',
				approvalUrl: 'https://paypal.com/approve'
			});

			// Verify fetch was called correctly
			expect(global.fetch).toHaveBeenCalledTimes(2);
		});

		it('should convert cents to euros correctly', async () => {
			(global.fetch as any).mockResolvedValueOnce({
				ok: true,
				json: async () => ({ access_token: 'test-token' })
			});

			(global.fetch as any).mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					id: 'ORDER-123',
					links: [{ href: 'https://paypal.com/approve', rel: 'approve' }]
				})
			});

			await createPayPalOrder(2500, 'membership-123'); // 2500 cents = €25.00

			const orderRequest = (global.fetch as any).mock.calls[1];
			const body = JSON.parse(orderRequest[1].body);

			expect(body.purchase_units[0].amount.value).toBe('25.00');
			expect(body.purchase_units[0].amount.currency_code).toBe('EUR');
		});

		it('should throw error if auth fails', async () => {
			(global.fetch as any).mockResolvedValueOnce({
				ok: false,
				text: async () => 'Authentication failed'
			});

			await expect(createPayPalOrder(2500, 'membership-123')).rejects.toThrow(
				'PayPal auth failed'
			);
		});

		it('should throw error if no approval link', async () => {
			(global.fetch as any).mockResolvedValueOnce({
				ok: true,
				json: async () => ({ access_token: 'test-token' })
			});

			(global.fetch as any).mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					id: 'ORDER-123',
					links: [] // No approval link
				})
			});

			await expect(createPayPalOrder(2500, 'membership-123')).rejects.toThrow(
				'No approval URL in PayPal response'
			);
		});
	});

	describe('capturePayPalOrder', () => {
		it('should capture a PayPal order successfully', async () => {
			(global.fetch as any).mockResolvedValueOnce({
				ok: true,
				json: async () => ({ access_token: 'test-token' })
			});

			(global.fetch as any).mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					id: 'ORDER-123',
					status: 'COMPLETED',
					purchase_units: [
						{
							payments: {
								captures: [
									{
										id: 'CAPTURE-123',
										status: 'COMPLETED',
										amount: {
											value: '25.00',
											currency_code: 'EUR'
										}
									}
								]
							}
						}
					]
				})
			});

			const result = await capturePayPalOrder('ORDER-123');

			expect(result).toEqual({
				status: 'COMPLETED',
				captureId: 'CAPTURE-123',
				amount: 2500 // Converted to cents
			});
		});

		it('should convert euros to cents correctly', async () => {
			(global.fetch as any).mockResolvedValueOnce({
				ok: true,
				json: async () => ({ access_token: 'test-token' })
			});

			(global.fetch as any).mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					purchase_units: [
						{
							payments: {
								captures: [
									{
										id: 'CAPTURE-123',
										status: 'COMPLETED',
										amount: { value: '49.99' }
									}
								]
							}
						}
					]
				})
			});

			const result = await capturePayPalOrder('ORDER-123');

			expect(result.amount).toBe(4999); // €49.99 = 4999 cents
		});

		it('should throw error if capture fails', async () => {
			(global.fetch as any).mockResolvedValueOnce({
				ok: true,
				json: async () => ({ access_token: 'test-token' })
			});

			(global.fetch as any).mockResolvedValueOnce({
				ok: false,
				text: async () => 'Capture failed'
			});

			// Error message sanitized to not expose PayPal internals
			await expect(capturePayPalOrder('ORDER-123')).rejects.toThrow(
				'Payment capture failed. Please try again or contact support.'
			);
		});
	});

	describe('getPayPalOrderDetails', () => {
		it('should get order details successfully', async () => {
			(global.fetch as any).mockResolvedValueOnce({
				ok: true,
				json: async () => ({ access_token: 'test-token' })
			});

			(global.fetch as any).mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					id: 'ORDER-123',
					status: 'APPROVED',
					purchase_units: [
						{
							amount: {
								value: '25.00',
								currency_code: 'EUR'
							}
						}
					]
				})
			});

			const result = await getPayPalOrderDetails('ORDER-123');

			expect(result).toEqual({
				id: 'ORDER-123',
				status: 'APPROVED',
				amount: 2500,
				currency: 'EUR'
			});
		});

		it('should throw error if request fails', async () => {
			(global.fetch as any).mockResolvedValueOnce({
				ok: true,
				json: async () => ({ access_token: 'test-token' })
			});

			(global.fetch as any).mockResolvedValueOnce({
				ok: false,
				text: async () => 'Order not found'
			});

			await expect(getPayPalOrderDetails('ORDER-123')).rejects.toThrow(
				'Failed to get PayPal order'
			);
		});
	});
});
