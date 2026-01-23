/**
 * Payment Success Page Server
 *
 * Shows payment confirmation and membership status.
 */

import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getMembershipSummary } from '$lib/server/services/membership';
import { SystemState } from '$lib/types/membership';

export const load: PageServerLoad = async ({ locals }) => {
	// User is guaranteed to be authenticated by hooks.server.ts
	const user = locals.user;

	if (!user) {
		throw redirect(303, '/auth/login');
	}

	// Get membership summary
	const summary = await getMembershipSummary(user.id);

	// If user hasn't paid, redirect to subscription
	if (
		summary.systemState === SystemState.S0_NO_MEMBERSHIP ||
		summary.systemState === SystemState.S1_PROFILE_COMPLETE ||
		summary.systemState === SystemState.S3_PAYMENT_FAILED
	) {
		throw redirect(303, '/membership/subscription');
	}

	return {
		membershipState: summary.systemState,
		italianLabel: summary.italianLabel,
		membershipNumber: summary.membershipNumber,
		isProcessing: summary.systemState === SystemState.S2_PROCESSING_PAYMENT,
		isAwaitingNumber: summary.systemState === SystemState.S4_AWAITING_NUMBER,
		isActive: summary.systemState === SystemState.S5_ACTIVE
	};
};
