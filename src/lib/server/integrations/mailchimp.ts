/**
 * Mailchimp Integration
 *
 * Handles newsletter subscription management via Mailchimp API.
 */

import mailchimp from '@mailchimp/mailchimp_marketing';
import crypto from 'crypto';
import { z } from 'zod';
import {
	MAILCHIMP_API_KEY,
	MAILCHIMP_SERVER_PREFIX,
	MAILCHIMP_AUDIENCE_ID
} from '$env/static/private';
import { env as dynamicEnv } from '$env/dynamic/private';
import { createLogger } from '$lib/server/utils/logger';

const mailchimpLogger = createLogger({ module: 'mailchimp' });

// Configure Mailchimp client
mailchimp.setConfig({
	apiKey: MAILCHIMP_API_KEY,
	server: MAILCHIMP_SERVER_PREFIX
});

/**
 * Email validation schema
 */
const emailSchema = z.string().email();

/**
 * Calculate MD5 hash for Mailchimp subscriber lookup
 * Mailchimp requires MD5 hash of lowercase email for subscriber operations
 */
function getSubscriberHash(email: string): string {
	return crypto.createHash('md5').update(email.toLowerCase()).digest('hex');
}

/**
 * Mask email for logging (GDPR compliance)
 * Example: test@example.com -> te***@example.com
 */
function maskEmail(email: string): string {
	const [local, domain] = email.split('@');
	if (!local || !domain) return '***';
	const visibleChars = Math.min(2, local.length);
	return `${local.substring(0, visibleChars)}***@${domain}`;
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
 * Subscriber profile data for Mailchimp
 */
export interface SubscriberProfile {
	firstName: string;
	lastName: string;
	address?: string;
	city?: string;
	postalCode?: string;
	province?: string;
	country?: string;
	taxCode?: string;
	birthDate?: Date | null;
	birthCity?: string;
}

/**
 * Get member tag dynamically based on environment or current year
 */
function getMemberTag(): string {
	const customTag = dynamicEnv.MAILCHIMP_MEMBER_TAG;
	if (customTag && customTag.length > 0) {
		return customTag;
	}
	const year = new Date().getFullYear();
	return `TESSERATI AICS ${year}`;
}

/**
 * Format date as DD/MM/YYYY for Mailchimp
 */
function formatDateForMailchimp(date: Date | null | undefined): string {
	if (!date) return '';
	const d = new Date(date);
	const day = String(d.getDate()).padStart(2, '0');
	const month = String(d.getMonth() + 1).padStart(2, '0');
	const year = d.getFullYear();
	return `${day}/${month}/${year}`;
}

/**
 * Truncate string to max length for Mailchimp field limits
 */
function truncate(value: string | undefined, maxLength: number): string {
	if (!value) return '';
	return value.slice(0, maxLength);
}

/**
 * Build merge fields object from profile data
 * Merge field tags from Mailchimp audience settings:
 * - FNAME: Nome (max 255)
 * - LNAME: Cognome (max 255)
 * - ADDRESS: Indirizzo (Mailchimp address object)
 * - MMERGE7: Codice Fiscale
 * - MMERGE11: Data di nascita (DD/MM/YYYY)
 * - MMERGE12: Luogo di Nascita
 */
function buildMergeFields(profile: SubscriberProfile): Record<string, unknown> {
	const fields: Record<string, unknown> = {
		FNAME: truncate(profile.firstName, 255),
		LNAME: truncate(profile.lastName, 255)
	};

	// Address (Mailchimp address object format - NOT JSON string)
	if (profile.address) {
		fields.ADDRESS = {
			addr1: truncate(profile.address, 255),
			city: truncate(profile.city, 100) || '',
			state: truncate(profile.province, 50) || '',
			zip: truncate(profile.postalCode, 20) || '',
			country: profile.country || 'IT'
		};
	}

	// Codice Fiscale (MMERGE7)
	if (profile.taxCode) {
		fields.MMERGE7 = truncate(profile.taxCode, 16);
	}

	// Data di nascita - DD/MM/YYYY (MMERGE11)
	if (profile.birthDate) {
		fields.MMERGE11 = formatDateForMailchimp(profile.birthDate);
	}

	// Luogo di Nascita (MMERGE12)
	if (profile.birthCity) {
		fields.MMERGE12 = truncate(profile.birthCity, 255);
	}

	return fields;
}

/**
 * Add tag to a subscriber using the Mailchimp API directly
 */
async function addTagToSubscriber(subscriberHash: string, tag: string, maskedEmail: string): Promise<void> {
	try {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const listsClient = mailchimp.lists as any;
		await listsClient.updateListMemberTags(MAILCHIMP_AUDIENCE_ID, subscriberHash, {
			tags: [{ name: tag, status: 'active' }]
		});
		mailchimpLogger.info({ email: maskedEmail, tag }, 'Tag added to subscriber');
	} catch (error) {
		mailchimpLogger.error({ err: error, email: maskedEmail, tag }, 'Failed to add tag to subscriber');
		// Don't throw - tag is not critical
	}
}

/**
 * Check if error indicates the member already exists in Mailchimp
 */
function isMemberExistsError(error: unknown): boolean {
	const mailchimpError = error as { status?: number; response?: { body?: { title?: string } } };
	return mailchimpError.status === 400 && mailchimpError.response?.body?.title === 'Member Exists';
}

/**
 * Validate email before API operations
 */
function validateEmail(email: string): string {
	const result = emailSchema.safeParse(email?.toLowerCase().trim());
	if (!result.success) {
		throw new MailchimpError('Invalid email address');
	}
	return result.data;
}

/**
 * Subscribe a user to the newsletter
 * If the member already exists (e.g., previously unsubscribed), reactivate them
 * @throws MailchimpError if subscription fails
 */
export async function subscribeToNewsletter(
	email: string,
	profile: SubscriberProfile
): Promise<{ subscriberId: string }> {
	const validatedEmail = validateEmail(email);
	const maskedEmail = maskEmail(validatedEmail);
	const mergeFields = buildMergeFields(profile);
	const subscriberHash = getSubscriberHash(validatedEmail);
	const memberTag = getMemberTag();

	let subscriberId: string;

	try {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const response = await mailchimp.lists.addListMember(MAILCHIMP_AUDIENCE_ID, {
			email_address: validatedEmail,
			status: 'subscribed',
			merge_fields: mergeFields as any
		});
		subscriberId = response.id as string;
		mailchimpLogger.info({ email: maskedEmail, subscriberId }, 'User subscribed to newsletter');
	} catch (error: unknown) {
		if (!isMemberExistsError(error)) {
			mailchimpLogger.error({ err: error, email: maskedEmail }, 'Mailchimp subscription error');
			throw new MailchimpError('Failed to subscribe to newsletter', error);
		}

		// Reactivate existing subscriber and get their actual ID
		mailchimpLogger.info({ email: maskedEmail }, 'Member exists, reactivating subscription');

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const updateResponse = await mailchimp.lists.updateListMember(MAILCHIMP_AUDIENCE_ID, subscriberHash, {
			status: 'subscribed',
			merge_fields: mergeFields as any
		});

		// Use the actual ID from the update response, not the hash
		subscriberId = (updateResponse.id as string) || subscriberHash;
		mailchimpLogger.info({ email: maskedEmail, subscriberId }, 'User resubscribed to newsletter');
	}

	// Add tag (non-blocking)
	await addTagToSubscriber(subscriberHash, memberTag, maskedEmail);

	return { subscriberId };
}

/**
 * Unsubscribe a user from the newsletter
 * @throws MailchimpError if unsubscription fails
 */
export async function unsubscribeFromNewsletter(email: string): Promise<void> {
	const validatedEmail = validateEmail(email);
	const maskedEmail = maskEmail(validatedEmail);

	try {
		const subscriberHash = getSubscriberHash(validatedEmail);

		await mailchimp.lists.updateListMember(MAILCHIMP_AUDIENCE_ID, subscriberHash, {
			status: 'unsubscribed'
		});

		mailchimpLogger.info({ email: maskedEmail }, 'User unsubscribed from newsletter');
	} catch (error) {
		mailchimpLogger.error({ err: error, email: maskedEmail }, 'Mailchimp unsubscribe error');
		throw new MailchimpError('Failed to unsubscribe from newsletter', error);
	}
}

/**
 * Update subscriber information
 * @throws MailchimpError if update fails
 */
export async function updateSubscriber(
	email: string,
	profile: Partial<SubscriberProfile>
): Promise<void> {
	const validatedEmail = validateEmail(email);
	const maskedEmail = maskEmail(validatedEmail);
	const subscriberHash = getSubscriberHash(validatedEmail);
	const memberTag = getMemberTag();

	try {
		const mergeFields = buildMergeFields({
			firstName: profile.firstName || '',
			lastName: profile.lastName || '',
			...profile
		});

		// Run update and tag in parallel for better performance
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		await Promise.all([
			mailchimp.lists.updateListMember(MAILCHIMP_AUDIENCE_ID, subscriberHash, {
				merge_fields: mergeFields as any
			}),
			addTagToSubscriber(subscriberHash, memberTag, maskedEmail)
		]);

		mailchimpLogger.info({ email: maskedEmail }, 'Subscriber info updated');
	} catch (error) {
		mailchimpLogger.error({ err: error, email: maskedEmail }, 'Mailchimp update error');
		throw new MailchimpError('Failed to update subscriber information', error);
	}
}
