/**
 * Payment Cancel Page Server
 *
 * Shows payment cancellation message and resets membership state.
 */

import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { prisma } from '$lib/server/db/prisma';
import { PaymentStatus } from '@prisma/client';
import { createLogger } from '$lib/server/utils/logger';

const logger = createLogger({ module: 'payment-cancel' });

export const load: PageServerLoad = async ({ locals }) => {
	// User is guaranteed to be authenticated by hooks.server.ts
	const user = locals.user;

	if (!user) {
		throw redirect(303, '/auth/login');
	}

	// Reset any pending payment so user can retry
	// This handles the case where user is redirected from PayPal
	try {
		const membership = await prisma.membership.findFirst({
			where: {
				userId: user.id,
				paymentStatus: PaymentStatus.PENDING,
				paymentProviderId: { not: null }
			},
			orderBy: { createdAt: 'desc' }
		});

		if (membership) {
			await prisma.membership.update({
				where: { id: membership.id },
				data: {
					paymentProviderId: null
				}
			});

			logger.info(
				{ userId: user.id, membershipId: membership.id },
				'Payment canceled via redirect, membership reset for retry'
			);
		}
	} catch (err) {
		logger.error({ err, userId: user.id }, 'Failed to reset membership on cancel page');
		// Don't throw - still show the cancel page
	}

	return {};
};
