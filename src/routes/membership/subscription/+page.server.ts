import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { userProfileSchema, formatZodErrors } from '$lib/server/utils/validation';
import { extractGenderFromTaxCode } from '$lib/server/utils/tax-code';
import { prisma } from '$lib/server/db/prisma';
import { createLogger } from '$lib/server/utils/logger';
import { getGooglePlacesApiKey } from '$lib/server/config/env';
import { getMembershipSummary } from '$lib/server/services/membership';
import { SystemState } from '$lib/types/membership';

const logger = createLogger({ module: 'membership' });

export const load: PageServerLoad = async ({ locals }) => {
	// User is guaranteed to be authenticated by hooks.server.ts
	const user = locals.user;

	if (!user) {
		throw redirect(303, '/auth/login');
	}

	// Load the full user profile for the form
	const profile = await prisma.userProfile.findUnique({
		where: { userId: user.id },
		select: {
			firstName: true,
			lastName: true,
			birthDate: true,
			taxCode: true,
			nationality: true,
			birthProvince: true,
			birthCity: true,
			hasForeignTaxCode: true,
			gender: true,
			address: true,
			city: true,
			postalCode: true,
			province: true,
			residenceCountry: true,
			phone: true,
			privacyConsent: true,
			dataConsent: true
		}
	});

	// Get membership summary to determine state
	const membershipSummary = await getMembershipSummary(user.id);

	return {
		user: {
			email: user.email
		},
		profile: profile
			? {
					firstName: profile.firstName,
					lastName: profile.lastName,
					birthDate: profile.birthDate,
					taxCode: profile.taxCode,
					nationality: profile.nationality,
					birthProvince: profile.birthProvince,
					birthCity: profile.birthCity,
					hasForeignTaxCode: profile.hasForeignTaxCode,
					gender: profile.gender,
					address: profile.address,
					city: profile.city,
					postalCode: profile.postalCode,
					province: profile.province,
					residenceCountry: profile.residenceCountry,
					phone: profile.phone,
					privacyConsent: profile.privacyConsent,
					dataConsent: profile.dataConsent
				}
			: null,
		googlePlacesApiKey: getGooglePlacesApiKey(),
		membershipState: membershipSummary.systemState,
		membershipNumber: membershipSummary.membershipNumber,
		profileComplete: membershipSummary.profileComplete,
		canProceedToPayment:
			membershipSummary.profileComplete &&
			(membershipSummary.systemState === SystemState.S0_NO_MEMBERSHIP ||
				membershipSummary.systemState === SystemState.S1_PROFILE_COMPLETE ||
				membershipSummary.systemState === SystemState.S3_PAYMENT_FAILED ||
				membershipSummary.systemState === SystemState.S6_EXPIRED ||
				membershipSummary.systemState === SystemState.S7_CANCELED)
	};
};

export const actions = {
	default: async ({ request, locals }) => {
		const user = locals.user;

		if (!user) {
			return fail(401, { errors: { _form: 'Non autorizzato' } });
		}

		const formData = await request.formData();

		// Extract all form fields
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
			address: formData.get('address'),
			city: formData.get('city'),
			postalCode: formData.get('postalCode'),
			province: formData.get('province'),
			phone: formData.get('phone') || '',
			documentType: formData.get('documentType') || '',
			documentNumber: formData.get('documentNumber') || '',
			privacyConsent: formData.get('privacyConsent') === 'true',
			dataConsent: formData.get('dataConsent') === 'true'
		};

		// Validate input
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
					dataConsent: rawData.dataConsent
				}
			});
		}

		try {
			const d = validation.data;

			// Check if all required AICS fields are filled to mark profile as complete
			const isProfileComplete =
				!!d.firstName &&
				!!d.lastName &&
				!!d.birthDate &&
				!!d.nationality &&
				!!d.birthProvince &&
				!!d.birthCity &&
				!!d.address &&
				!!d.city &&
				!!d.postalCode &&
				!!d.province &&
				d.privacyConsent === true &&
				d.dataConsent === true;

			// Derive gender from tax code if present, otherwise use form value
			const derivedGender = d.taxCode ? extractGenderFromTaxCode(d.taxCode) : null;
			const finalGender = derivedGender || d.gender || null;

			// Profile data shared between create and update
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

			// Use upsert to atomically create or update profile (prevents race conditions)
			await prisma.userProfile.upsert({
				where: { userId: user.id },
				update: profileData,
				create: { userId: user.id, ...profileData }
			});

			// Always return success - no auto-redirect
			// User can click "Procedi al pagamento" separately if they want to pay
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
					lastName: validation.data.lastName
				}
			});
		}
	}
} satisfies Actions;
