/**
 * Membership Status API
 *
 * Returns the current membership status for polling on success page.
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getMembershipSummary } from '$lib/server/services/membership';

export const GET: RequestHandler = async ({ locals }) => {
	// Verify user is authenticated
	const user = locals.user;
	if (!user) {
		throw error(401, 'Non autorizzato');
	}

	const summary = await getMembershipSummary(user.id);

	return json({
		systemState: summary.systemState,
		italianLabel: summary.italianLabel,
		paymentStatus: summary.hasActiveMembership ? 'active' : 'pending',
		membershipNumber: summary.membershipNumber,
		profileComplete: summary.profileComplete,
		canPurchase: summary.canPurchase
	});
};
