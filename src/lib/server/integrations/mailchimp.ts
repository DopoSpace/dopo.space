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
 * Subscribe a user to the newsletter
 */
export async function subscribeToNewsletter(
	email: string,
	firstName: string,
	lastName: string
): Promise<{ success: boolean; subscriberId?: string; error?: string }> {
	try {
		const response = await mailchimp.lists.addListMember(MAILCHIMP_AUDIENCE_ID, {
			email_address: email,
			status: 'subscribed',
			merge_fields: {
				FNAME: firstName,
				LNAME: lastName
			}
		});

		return {
			success: true,
			subscriberId: response.id
		};
	} catch (error) {
		mailchimpLogger.error(error, 'Mailchimp subscription error');
		return {
			success: false,
			error: error instanceof Error ? error.message : 'Unknown error'
		};
	}
}

/**
 * Unsubscribe a user from the newsletter
 */
export async function unsubscribeFromNewsletter(
	email: string
): Promise<{ success: boolean; error?: string }> {
	try {
		const subscriberHash = getSubscriberHash(email);

		await mailchimp.lists.updateListMember(MAILCHIMP_AUDIENCE_ID, subscriberHash, {
			status: 'unsubscribed'
		});

		return { success: true };
	} catch (error) {
		mailchimpLogger.error(error, 'Mailchimp unsubscribe error');
		return {
			success: false,
			error: error instanceof Error ? error.message : 'Unknown error'
		};
	}
}

/**
 * Update subscriber information
 */
export async function updateSubscriber(
	email: string,
	data: { firstName?: string; lastName?: string }
): Promise<{ success: boolean; error?: string }> {
	try {
		const subscriberHash = getSubscriberHash(email);

		await mailchimp.lists.updateListMember(MAILCHIMP_AUDIENCE_ID, subscriberHash, {
			merge_fields: {
				...(data.firstName && { FNAME: data.firstName }),
				...(data.lastName && { LNAME: data.lastName })
			}
		});

		return { success: true };
	} catch (error) {
		mailchimpLogger.error(error, 'Mailchimp update error');
		return {
			success: false,
			error: error instanceof Error ? error.message : 'Unknown error'
		};
	}
}
