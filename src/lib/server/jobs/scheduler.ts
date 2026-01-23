/**
 * Scheduled Jobs
 *
 * Cron jobs for automated tasks like membership expiration.
 */

import cron from 'node-cron';
import { updateExpiredMemberships } from '../services/membership';
import pino from 'pino';

const logger = pino({ name: 'scheduler' });

let isInitialized = false;

/**
 * Initialize all scheduled jobs
 * Should only be called once at startup in production
 */
export function initializeScheduler(): void {
	if (isInitialized) {
		logger.warn('Scheduler already initialized, skipping');
		return;
	}

	// Run daily at 5:00 AM Europe/Rome time
	// Cron format: minute hour day-of-month month day-of-week
	cron.schedule(
		'0 5 * * *',
		async () => {
			logger.info('Starting scheduled membership expiration check');

			try {
				const result = await updateExpiredMemberships();
				logger.info(
					{ processed: result.processed },
					'Completed scheduled membership expiration check'
				);
			} catch (error) {
				logger.error({ err: error }, 'Failed to run membership expiration check');
			}
		},
		{
			timezone: 'Europe/Rome'
		}
	);

	isInitialized = true;
	logger.info('Scheduler initialized - membership expiration job scheduled for 5:00 AM Europe/Rome');
}

/**
 * Check if the scheduler has been initialized
 */
export function isSchedulerInitialized(): boolean {
	return isInitialized;
}
