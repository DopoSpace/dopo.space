import { json, redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { prisma } from '$lib/server/db/prisma';
import { calculateEndDate } from '$lib/server/services/membership';
import { createLogger } from '$lib/server/utils/logger';

const logger = createLogger({ module: 'admin-bulk-start-date' });

export const POST: RequestHandler = async ({ locals, request }) => {
	const admin = locals.admin;
	if (!admin) {
		throw redirect(303, '/login');
	}

	try {
		const body = await request.json();
		const { userIds, startDate: startDateStr } = body as {
			userIds: string[];
			startDate: string;
		};

		if (!Array.isArray(userIds) || userIds.length === 0) {
			return json({ success: false, error: 'Nessun utente selezionato.' }, { status: 400 });
		}

		if (!startDateStr) {
			return json({ success: false, error: 'Data di inizio non specificata.' }, { status: 400 });
		}

		const match = startDateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
		if (!match) {
			return json({ success: false, error: 'Formato data non valido (atteso YYYY-MM-DD).' }, { status: 400 });
		}

		const [, year, month, day] = match;
		const startDate = new Date(parseInt(year, 10), parseInt(month, 10) - 1, parseInt(day, 10));
		if (isNaN(startDate.getTime())) {
			return json({ success: false, error: 'Data non valida.' }, { status: 400 });
		}

		const endDate = calculateEndDate(startDate);

		// Find the most recent membership for each user
		const memberships = await prisma.membership.findMany({
			where: {
				userId: { in: userIds }
			},
			orderBy: { createdAt: 'desc' },
			distinct: ['userId'],
			select: {
				id: true,
				userId: true
			}
		});

		const membershipMap = new Map(memberships.map((m) => [m.userId, m.id]));

		let updated = 0;
		let skipped = 0;

		for (const userId of userIds) {
			const membershipId = membershipMap.get(userId);
			if (!membershipId) {
				skipped++;
				continue;
			}

			await prisma.membership.update({
				where: { id: membershipId },
				data: {
					startDate,
					endDate,
					updatedBy: admin.id
				}
			});
			updated++;
		}

		logger.info(
			{ adminEmail: admin.email, updated, skipped, startDate: startDateStr, userCount: userIds.length },
			'Bulk start date update completed'
		);

		return json({ success: true, updated, skipped });
	} catch (err) {
		logger.error({ err }, 'Bulk start date update failed');
		return json({ success: false, error: 'Errore durante l\'aggiornamento.' }, { status: 500 });
	}
};
