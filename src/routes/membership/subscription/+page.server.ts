import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { userProfileSchema, formatZodErrors } from '$lib/server/utils/validation';
import { extractGenderFromTaxCode } from '$lib/server/utils/tax-code';
import { prisma } from '$lib/server/db/prisma';
import { createLogger } from '$lib/server/utils/logger';
import { getGooglePlacesApiKey } from '$lib/server/config/env';
import { SystemState } from '$lib/types/membership';
import { MembershipStatus, PaymentStatus } from '@prisma/client';
import {
	subscribeToNewsletter,
	unsubscribeFromNewsletter,
	updateSubscriber
} from '$lib/server/integrations/mailchimp';

const logger = createLogger({ module: 'membership' });

/**
 * Compute membership state from user data (avoids redundant DB query)
 */
function computeMembershipState(user: {
	profile: { profileComplete: boolean; firstName: string | null; lastName: string | null; birthDate: Date | null; privacyConsent: boolean | null; dataConsent: boolean | null } | null;
	memberships: Array<{ status: MembershipStatus; paymentStatus: PaymentStatus; membershipNumber: string | null; endDate: Date | null; paymentProviderId: string | null }>;
}) {
	const profile = user.profile;
	const membership = user.memberships[0];

	const profileComplete =
		!!profile &&
		profile.profileComplete &&
		!!profile.firstName &&
		!!profile.lastName &&
		!!profile.birthDate &&
		!!profile.privacyConsent &&
		!!profile.dataConsent;

	if (!membership) {
		return {
			systemState: profileComplete ? SystemState.S1_PROFILE_COMPLETE : SystemState.S0_NO_MEMBERSHIP,
			membershipNumber: null,
			profileComplete
		};
	}

	// Canceled
	if (membership.status === MembershipStatus.CANCELED) {
		return { systemState: SystemState.S7_CANCELED, membershipNumber: null, profileComplete };
	}

	// Expired (check status first, before date-based expiration)
	if (membership.status === MembershipStatus.EXPIRED) {
		return { systemState: SystemState.S6_EXPIRED, membershipNumber: null, profileComplete };
	}

	// Check expiration by date (for ACTIVE memberships)
	const isExpired = membership.endDate && new Date() > membership.endDate;

	// Active with number
	if (membership.status === MembershipStatus.ACTIVE && membership.membershipNumber) {
		return {
			systemState: isExpired ? SystemState.S6_EXPIRED : SystemState.S5_ACTIVE,
			membershipNumber: membership.membershipNumber,
			profileComplete
		};
	}

	// S3: Payment failed or canceled
	if (membership.paymentStatus === PaymentStatus.FAILED || membership.paymentStatus === PaymentStatus.CANCELED) {
		return { systemState: SystemState.S3_PAYMENT_FAILED, membershipNumber: null, profileComplete };
	}

	// S2: Payment in progress (has paymentProviderId but not yet completed)
	if (
		membership.paymentStatus === PaymentStatus.PENDING &&
		membership.paymentProviderId &&
		!membership.membershipNumber
	) {
		return { systemState: SystemState.S2_PROCESSING_PAYMENT, membershipNumber: null, profileComplete };
	}

	// S1 or S0: Pending payment depends on profile completeness
	if (membership.paymentStatus === PaymentStatus.PENDING) {
		const state = profileComplete ? SystemState.S1_PROFILE_COMPLETE : SystemState.S0_NO_MEMBERSHIP;
		return { systemState: state, membershipNumber: null, profileComplete };
	}

	if (membership.paymentStatus === PaymentStatus.SUCCEEDED && !membership.membershipNumber) {
		return { systemState: SystemState.S4_AWAITING_NUMBER, membershipNumber: null, profileComplete };
	}

	// Fallback
	return {
		systemState: profileComplete ? SystemState.S1_PROFILE_COMPLETE : SystemState.S0_NO_MEMBERSHIP,
		membershipNumber: null,
		profileComplete
	};
}

export const load: PageServerLoad = async ({ locals }) => {
	const user = locals.user;

	if (!user) {
		throw redirect(303, '/auth/login');
	}

	// Use data already loaded in hooks.server.ts - no additional queries needed
	const membershipState = computeMembershipState(user as Parameters<typeof computeMembershipState>[0]);

	return {
		user: {
			email: user.email,
			newsletterSubscribed: user.newsletterSubscribed ?? false
		},
		profile: user.profile,
		googlePlacesApiKey: getGooglePlacesApiKey(),
		membershipState: membershipState.systemState,
		membershipNumber: membershipState.membershipNumber,
		profileComplete: membershipState.profileComplete,
		canProceedToPayment:
			membershipState.profileComplete &&
			(membershipState.systemState === SystemState.S0_NO_MEMBERSHIP ||
				membershipState.systemState === SystemState.S1_PROFILE_COMPLETE ||
				membershipState.systemState === SystemState.S3_PAYMENT_FAILED ||
				membershipState.systemState === SystemState.S6_EXPIRED ||
				membershipState.systemState === SystemState.S7_CANCELED)
	};
};

export const actions = {
	default: async ({ request, locals }) => {
		const user = locals.user;

		if (!user) {
			return fail(401, { errors: { _form: 'Non autorizzato' } });
		}

		const formData = await request.formData();
		const newsletterConsent = formData.get('newsletterConsent') === 'true';

		const rawData = {
			firstName: formData.get('firstName'),
			lastName: formData.get('lastName'),
			birthDate: formData.get('birthDate'),
			nationality: formData.get('nationality'),
			birthProvince: formData.get('birthProvince'),
			birthCity: formData.get('birthCity'),
			hasForeignTaxCode: formData.get('hasForeignTaxCode') === 'true',
			gender: formData.get('gender') || '',
			taxCode: formData.get('taxCode') || '',
			residenceCountry: formData.get('residenceCountry') || 'IT',
			address: formData.get('address') || '',
			city: formData.get('city') || '',
			postalCode: formData.get('postalCode') || '',
			province: formData.get('province') || '',
			phone: formData.get('phone') || '',
			documentType: formData.get('documentType') || '',
			documentNumber: formData.get('documentNumber') || '',
			privacyConsent: formData.get('privacyConsent') === 'true',
			dataConsent: formData.get('dataConsent') === 'true'
		};

		const validation = userProfileSchema.safeParse(rawData);

		if (!validation.success) {
			const errors = formatZodErrors(validation.error);
			return fail(400, {
				errors,
				values: {
					firstName: rawData.firstName as string,
					lastName: rawData.lastName as string,
					birthDate: rawData.birthDate as string,
					nationality: rawData.nationality as string,
					birthProvince: rawData.birthProvince as string,
					birthCity: rawData.birthCity as string,
					hasForeignTaxCode: rawData.hasForeignTaxCode,
					gender: rawData.gender as string,
					taxCode: rawData.taxCode as string,
					address: rawData.address as string,
					city: rawData.city as string,
					postalCode: rawData.postalCode as string,
					province: rawData.province as string,
					phone: rawData.phone as string,
					privacyConsent: rawData.privacyConsent,
					dataConsent: rawData.dataConsent,
					newsletterConsent // Persist newsletter checkbox on validation failure
				}
			});
		}

		try {
			const d = validation.data;

			const isProfileComplete =
				!!d.firstName &&
				!!d.lastName &&
				!!d.birthDate &&
				!!d.nationality &&
				!!d.birthProvince &&
				!!d.birthCity &&
				d.privacyConsent === true &&
				d.dataConsent === true;

			const derivedGender = d.taxCode ? extractGenderFromTaxCode(d.taxCode) : null;
			const finalGender = derivedGender || d.gender || null;

			const profileData = {
				firstName: d.firstName,
				lastName: d.lastName,
				birthDate: d.birthDate,
				taxCode: d.taxCode || null,
				nationality: d.nationality,
				birthProvince: d.birthProvince,
				birthCity: d.birthCity,
				hasForeignTaxCode: d.hasForeignTaxCode,
				gender: finalGender,
				residenceCountry: d.residenceCountry,
				address: d.address,
				city: d.city,
				postalCode: d.postalCode,
				province: d.province,
				phone: d.phone || null,
				documentType: d.documentType || null,
				documentNumber: d.documentNumber || null,
				privacyConsent: d.privacyConsent,
				dataConsent: d.dataConsent,
				profileComplete: isProfileComplete
			};

			await prisma.userProfile.upsert({
				where: { userId: user.id },
				update: profileData,
				create: { userId: user.id, ...profileData }
			});

			// Handle newsletter subscription (errors don't block profile save)
			// Use cached value from locals.user instead of querying DB again
			const wasSubscribed = user.newsletterSubscribed ?? false;

			const subscriberProfile = {
				firstName: d.firstName,
				lastName: d.lastName,
				address: d.address,
				city: d.city,
				postalCode: d.postalCode,
				province: d.province,
				country: d.residenceCountry,
				taxCode: d.taxCode || undefined,
				birthDate: d.birthDate,
				birthCity: d.birthCity
			};

			try {
				if (!wasSubscribed && newsletterConsent) {
					const result = await subscribeToNewsletter(user.email, subscriberProfile);

					if (result.status === 'forgotten_email') {
						// Email was permanently deleted from Mailchimp (GDPR)
						// User must manually re-subscribe - don't mark as subscribed
						logger.warn(
							{ userId: user.id },
							'Newsletter subscription skipped: email was permanently deleted from Mailchimp'
						);
					} else {
						// Successfully subscribed or resubscribed
						await prisma.user.update({
							where: { id: user.id },
							data: {
								newsletterSubscribed: true,
								mailchimpSubscriberId: result.subscriberId
							}
						});
						logger.info({ userId: user.id, status: result.status }, 'User subscribed to newsletter');
					}
				} else if (wasSubscribed && !newsletterConsent) {
					await unsubscribeFromNewsletter(user.email);
					await prisma.user.update({
						where: { id: user.id },
						data: { newsletterSubscribed: false }
					});
					logger.info({ userId: user.id }, 'User unsubscribed from newsletter');
				} else if (wasSubscribed && newsletterConsent) {
					await updateSubscriber(user.email, subscriberProfile);
					logger.info({ userId: user.id }, 'Newsletter subscriber info updated');
				}
			} catch (error) {
				logger.error({ err: error, userId: user.id }, 'Newsletter operation failed');
			}

			return {
				success: true,
				values: {
					firstName: validation.data.firstName,
					lastName: validation.data.lastName
				}
			};
		} catch (error) {
			logger.error({ err: error }, 'Error saving profile');
			return fail(500, {
				errors: { _form: 'Errore durante il salvataggio. Riprova più tardi.' },
				values: {
					firstName: validation.data.firstName,
					lastName: validation.data.lastName,
					newsletterConsent // Persist on error too
				}
			});
		}
	}
} satisfies Actions;
