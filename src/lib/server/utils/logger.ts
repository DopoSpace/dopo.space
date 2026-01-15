/**
 * Structured Logger using Pino
 *
 * Provides consistent, structured logging across the application
 * with different log levels and JSON output for production.
 */

import pino from 'pino';
import { dev } from '$app/environment';

/**
 * Create Pino logger instance with appropriate configuration
 */
export const logger = pino({
	level: dev ? 'debug' : 'info',
	transport: dev
		? {
				target: 'pino-pretty',
				options: {
					colorize: true,
					translateTime: 'HH:MM:ss',
					ignore: 'pid,hostname'
				}
		  }
		: undefined,
	// Production: JSON output for log aggregation tools
	formatters: {
		level: (label) => {
			return { level: label };
		}
	},
	timestamp: pino.stdTimeFunctions.isoTime
});

/**
 * Log levels:
 * - trace: Very detailed debugging information
 * - debug: Debugging information
 * - info: General information about application flow
 * - warn: Warning messages for potentially harmful situations
 * - error: Error messages for serious problems
 * - fatal: Critical errors that may cause application shutdown
 */

/**
 * Create a child logger with additional context
 * @param context - Additional context to add to all logs
 * @example
 * const authLogger = createLogger({ module: 'auth' });
 * authLogger.info('User logged in');
 */
export function createLogger(context: Record<string, unknown>) {
	return logger.child(context);
}

/**
 * Log authentication events
 */
export const authLogger = createLogger({ module: 'auth' });

/**
 * Log payment-related events
 */
export const paymentLogger = createLogger({ module: 'payment' });
