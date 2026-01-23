/**
 * Admin API: Manual Membership Expiration Trigger
 *
 * POST /api/admin/expire-memberships
 *
 * Manually triggers the membership expiration job.
 * This is the same job that runs daily via cron.
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { updateExpiredMemberships } from '$lib/server/services/membership';
import { createLogger } from '$lib/server/utils/logger';

const logger = createLogger({ module: 'admin-api' });

export const POST: RequestHandler = async ({ locals }) => {
	// Verify admin authentication
	if (!locals.admin) {
		return json({ error: 'Non autorizzato' }, { status: 401 });
	}

	try {
		logger.info(
			{ adminEmail: locals.admin.email },
			'Admin manually triggered membership expiration check'
		);

		const result = await updateExpiredMemberships();

		logger.info(
			{ adminEmail: locals.admin.email, processed: result.processed },
			'Manual membership expiration check completed'
		);

		return json({
			success: true,
			processed: result.processed,
			memberships: result.memberships
		});
	} catch (error) {
		logger.error({ err: error }, 'Failed to run manual membership expiration check');

		return json(
			{ error: 'Errore durante il controllo delle scadenze' },
			{ status: 500 }
		);
	}
};
