/**
 * Mailchimp Integration
 *
 * Handles newsletter subscription management via Mailchimp API.
 */

import mailchimp from '@mailchimp/mailchimp_marketing';
import crypto from 'crypto';
import {
	MAILCHIMP_API_KEY,
	MAILCHIMP_SERVER_PREFIX,
	MAILCHIMP_AUDIENCE_ID
} from '$env/static/private';
import { createLogger } from '$lib/server/utils/logger';

const mailchimpLogger = createLogger({ module: 'mailchimp' });

// Configure Mailchimp client
mailchimp.setConfig({
	apiKey: MAILCHIMP_API_KEY,
	server: MAILCHIMP_SERVER_PREFIX
});

/**
 * Calculate MD5 hash for Mailchimp subscriber lookup
 * Mailchimp requires MD5 hash of lowercase email for subscriber operations
 */
function getSubscriberHash(email: string): string {
	return crypto.createHash('md5').update(email.toLowerCase()).digest('hex');
}

/**
 * Custom error class for Mailchimp operations
 */
export class MailchimpError extends Error {
	constructor(message: string, public readonly cause?: unknown) {
		super(message);
		this.name = 'MailchimpError';
	}
}

/**
 * Subscribe a user to the newsletter
 * @throws MailchimpError if subscription fails
 */
export async function subscribeToNewsletter(
	email: string,
	firstName: string,
	lastName: string
): Promise<{ subscriberId: string }> {
	try {
		const response = await mailchimp.lists.addListMember(MAILCHIMP_AUDIENCE_ID, {
			email_address: email,
			status: 'subscribed',
			merge_fields: {
				FNAME: firstName,
				LNAME: lastName
			}
		});

		mailchimpLogger.info({ email, subscriberId: response.id }, 'User subscribed to newsletter');

		return {
			subscriberId: response.id as string
		};
	} catch (error) {
		mailchimpLogger.error({ err: error, email }, 'Mailchimp subscription error');
		throw new MailchimpError(
			'Failed to subscribe to newsletter',
			error
		);
	}
}

/**
 * Unsubscribe a user from the newsletter
 * @throws MailchimpError if unsubscription fails
 */
export async function unsubscribeFromNewsletter(email: string): Promise<void> {
	try {
		const subscriberHash = getSubscriberHash(email);

		await mailchimp.lists.updateListMember(MAILCHIMP_AUDIENCE_ID, subscriberHash, {
			status: 'unsubscribed'
		});

		mailchimpLogger.info({ email }, 'User unsubscribed from newsletter');
	} catch (error) {
		mailchimpLogger.error({ err: error, email }, 'Mailchimp unsubscribe error');
		throw new MailchimpError('Failed to unsubscribe from newsletter', error);
	}
}

/**
 * Update subscriber information
 * @throws MailchimpError if update fails
 */
export async function updateSubscriber(
	email: string,
	data: { firstName?: string; lastName?: string }
): Promise<void> {
	try {
		const subscriberHash = getSubscriberHash(email);

		await mailchimp.lists.updateListMember(MAILCHIMP_AUDIENCE_ID, subscriberHash, {
			merge_fields: {
				...(data.firstName && { FNAME: data.firstName }),
				...(data.lastName && { LNAME: data.lastName })
			}
		});

		mailchimpLogger.info({ email }, 'Subscriber info updated');
	} catch (error) {
		mailchimpLogger.error({ err: error, email }, 'Mailchimp update error');
		throw new MailchimpError('Failed to update subscriber information', error);
	}
}
