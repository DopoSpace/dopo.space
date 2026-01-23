/**
 * Checkout Page Server
 *
 * Validates user can proceed to checkout and provides PayPal configuration.
 */

import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getMembershipSummary } from '$lib/server/services/membership';
import { getMembershipFee } from '$lib/server/services/settings';
import { SystemState } from '$lib/types/membership';
import { PAYPAL_CLIENT_ID } from '$env/static/private';

export const load: PageServerLoad = async ({ locals }) => {
	// User is guaranteed to be authenticated by hooks.server.ts
	const user = locals.user;

	if (!user) {
		throw redirect(303, '/auth/login');
	}

	// Get membership summary to check state
	const summary = await getMembershipSummary(user.id);

	// Redirect if profile is not complete
	if (!summary.profileComplete) {
		throw redirect(303, '/membership/subscription');
	}

	// Redirect if already paid or active
	if (
		summary.systemState === SystemState.S4_AWAITING_NUMBER ||
		summary.systemState === SystemState.S5_ACTIVE
	) {
		throw redirect(303, '/membership/subscription');
	}

	// Get membership fee
	const fee = await getMembershipFee();

	return {
		paypalClientId: PAYPAL_CLIENT_ID,
		fee,
		membershipState: summary.systemState,
		italianLabel: summary.italianLabel
	};
};
