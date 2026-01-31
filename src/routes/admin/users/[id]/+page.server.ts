import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { prisma } from '$lib/server/db/prisma';
import { createLogger } from '$lib/server/utils/logger';
import { z } from 'zod';
import { formatZodErrors } from '$lib/server/utils/validation';
import { validateTaxCode, validateTaxCodeConsistency, extractGenderFromTaxCode, validateTaxCodeNameConsistency, suggestCompoundName } from '$lib/server/utils/tax-code';
import { ITALIAN_NAMES } from '$lib/server/data/italian-names';
import { getGooglePlacesApiKey } from '$lib/server/config/env';
import { cancelMembership, calculateEndDate } from '$lib/server/services/membership';
import { MembershipStatus } from '@prisma/client';

const logger = createLogger({ module: 'admin' });

/**
 * Admin profile update schema - less strict than user self-registration
 * Admin can set any field, validation is advisory
 */
const adminProfileSchema = z.object({
	firstName: z.string().min(1, 'Il nome è obbligatorio').max(50),
	lastName: z.string().min(1, 'Il cognome è obbligatorio').max(50),
	birthDate: z.coerce.date().optional().nullable(),
	nationality: z.string().length(2).toUpperCase().optional().or(z.literal('')),
	birthProvince: z.string().max(2).toUpperCase().optional().or(z.literal('')),
	birthCity: z.string().max(100).optional().or(z.literal('')),
	hasForeignTaxCode: z.coerce.boolean().default(false),
	gender: z.enum(['M', 'F']).optional().or(z.literal('')),
	taxCode: z.string().max(16).toUpperCase().optional().or(z.literal('')),
	residenceCountry: z.string().length(2).toUpperCase().optional().or(z.literal('')).default('IT'),
	address: z.string().max(200).optional().or(z.literal('')),
	city: z.string().max(100).optional().or(z.literal('')),
	postalCode: z.string().max(20).optional().or(z.literal('')), // Allow longer postal codes for foreign addresses
	province: z.string().max(2).toUpperCase().optional().or(z.literal('')),
	phone: z.string().max(20).optional().or(z.literal('')),
	privacyConsent: z.coerce.boolean().default(false),
	dataConsent: z.coerce.boolean().default(false)
});

export const load: PageServerLoad = async ({ locals, params }) => {
	const admin = locals.admin;

	if (!admin) {
		throw redirect(303, '/login');
	}

	const user = await prisma.user.findUnique({
		where: { id: params.id },
		include: {
			profile: true,
			memberships: {
				orderBy: { createdAt: 'desc' },
				take: 1
			}
		}
	});

	if (!user) {
		throw error(404, 'Utente non trovato');
	}

	const latestMembership = user.memberships[0];

	return {
		user: {
			id: user.id,
			email: user.email,
			phone: user.phone,
			newsletterSubscribed: user.newsletterSubscribed,
			createdAt: user.createdAt.toISOString(),
			updatedAt: user.updatedAt.toISOString(),
			profile: user.profile
				? {
						firstName: user.profile.firstName,
						lastName: user.profile.lastName,
						birthDate: user.profile.birthDate?.toISOString() || null,
						nationality: user.profile.nationality,
						birthProvince: user.profile.birthProvince,
						birthCity: user.profile.birthCity,
						hasForeignTaxCode: user.profile.hasForeignTaxCode,
						gender: user.profile.gender,
						taxCode: user.profile.taxCode,
						residenceCountry: user.profile.residenceCountry,
						address: user.profile.address,
						city: user.profile.city,
						postalCode: user.profile.postalCode,
						province: user.profile.province,
						phone: user.profile.phone,
						privacyConsent: user.profile.privacyConsent,
						dataConsent: user.profile.dataConsent,
						profileComplete: user.profile.profileComplete
					}
				: null,
			membership: latestMembership
				? {
						id: latestMembership.id,
						membershipNumber: latestMembership.membershipNumber,
						previousMembershipNumber: latestMembership.previousMembershipNumber,
						cardAssignedAt: latestMembership.cardAssignedAt?.toISOString() || null,
						status: latestMembership.status,
						paymentStatus: latestMembership.paymentStatus,
						paymentProviderId: latestMembership.paymentProviderId,
						paymentAmount: latestMembership.paymentAmount,
						startDate: latestMembership.startDate?.toISOString() || null,
						endDate: latestMembership.endDate?.toISOString() || null,
						createdAt: latestMembership.createdAt.toISOString(),
						updatedAt: latestMembership.updatedAt.toISOString(),
						updatedBy: latestMembership.updatedBy
					}
				: null
		},
		admin: { email: admin.email },
		googlePlacesApiKey: getGooglePlacesApiKey()
	};
};

export const actions = {
	updateEmail: async ({ request, params, locals }) => {
		const admin = locals.admin;

		if (!admin) {
			return fail(401, { emailError: 'Non autorizzato' });
		}

		const formData = await request.formData();
		const newEmail = formData.get('email');

		if (!newEmail || typeof newEmail !== 'string' || !newEmail.trim()) {
			return fail(400, { emailError: 'Email obbligatoria' });
		}

		const trimmed = newEmail.trim().toLowerCase();

		// Basic format check
		if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
			return fail(400, { emailError: 'Formato email non valido' });
		}

		try {
			const existing = await prisma.user.findUnique({
				where: { email: trimmed }
			});

			if (existing && existing.id !== params.id) {
				return fail(409, { emailError: `L'email ${trimmed} è già in uso da un altro utente` });
			}

			await prisma.user.update({
				where: { id: params.id },
				data: { email: trimmed }
			});

			logger.info(
				{ userId: params.id, adminEmail: admin.email, newEmail: trimmed },
				'Admin updated user email'
			);

			return { emailSuccess: true };
		} catch (err) {
			logger.error({ err, userId: params.id }, 'Error updating user email');
			return fail(500, { emailError: "Errore durante l'aggiornamento dell'email" });
		}
	},

	update: async ({ request, params, locals }) => {
		const admin = locals.admin;

		if (!admin) {
			return fail(401, { errors: { _form: 'Non autorizzato' } });
		}

		const formData = await request.formData();

		const rawData = {
			firstName: formData.get('firstName'),
			lastName: formData.get('lastName'),
			birthDate: formData.get('birthDate') || null,
			nationality: formData.get('nationality') || '',
			birthProvince: formData.get('birthProvince') || '',
			birthCity: formData.get('birthCity') || '',
			hasForeignTaxCode: formData.get('hasForeignTaxCode') === 'true',
			gender: formData.get('gender') || '',
			taxCode: formData.get('taxCode') || '',
			residenceCountry: formData.get('residenceCountry') || 'IT',
			address: formData.get('address') || '',
			city: formData.get('city') || '',
			postalCode: formData.get('postalCode') || '',
			province: formData.get('province') || '',
			phone: formData.get('phone') || '',
			privacyConsent: formData.get('privacyConsent') === 'true',
			dataConsent: formData.get('dataConsent') === 'true'
		};

		const validation = adminProfileSchema.safeParse(rawData);

		if (!validation.success) {
			const errors = formatZodErrors(validation.error);
			return fail(400, { errors, values: rawData });
		}

		const d = validation.data;

		// Additional validation for tax code if provided
		if (d.taxCode && d.taxCode.length > 0) {
			const taxCodeResult = validateTaxCode(d.taxCode);
			if (!taxCodeResult.valid) {
				return fail(400, {
					errors: { taxCode: taxCodeResult.error || 'Codice fiscale non valido' },
					values: rawData
				});
			}

			// Validate consistency with birth date if both are provided
			if (d.birthDate && !validateTaxCodeConsistency(d.taxCode, d.birthDate)) {
				return fail(400, {
					errors: { taxCode: 'La data di nascita non corrisponde al codice fiscale' },
					values: rawData
				});
			}
		}

		try {
			const user = await prisma.user.findUnique({
				where: { id: params.id },
				include: { profile: true }
			});

			if (!user) {
				return fail(404, { errors: { _form: 'Utente non trovato' } });
			}

			// Check if profile is complete (all required AICS fields filled)
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

			const profileData = {
				firstName: d.firstName,
				lastName: d.lastName,
				birthDate: d.birthDate || null,
				nationality: d.nationality || null,
				birthProvince: d.birthProvince || null,
				birthCity: d.birthCity || null,
				hasForeignTaxCode: d.hasForeignTaxCode,
				gender: finalGender,
				taxCode: d.taxCode || null,
				residenceCountry: d.residenceCountry || 'IT',
				address: d.address || null,
				city: d.city || null,
				postalCode: d.postalCode || null,
				province: d.province || null,
				phone: d.phone || null,
				privacyConsent: d.privacyConsent,
				dataConsent: d.dataConsent,
				profileComplete: isProfileComplete
			};

			await prisma.userProfile.upsert({
				where: { userId: user.id },
				update: profileData,
				create: { userId: user.id, ...profileData }
			});

			logger.info({ userId: user.id, adminEmail: admin.email }, 'Admin updated user profile');

			// Check name/CF consistency and suggest fix
			if (d.taxCode && d.firstName && d.lastName) {
				const nameWarning = validateTaxCodeNameConsistency(d.taxCode, d.firstName, d.lastName);
				if (nameWarning) {
					const suggested = suggestCompoundName(d.taxCode, d.firstName, ITALIAN_NAMES);
					if (suggested) {
						return {
							success: true,
							warning: `${nameWarning} Suggerimento: "${suggested}"`
						};
					}
					return { success: true, warning: nameWarning };
				}
			}

			return { success: true };
		} catch (err) {
			logger.error({ err }, 'Error updating user');
			return fail(500, {
				errors: { _form: "Errore durante l'aggiornamento. Riprova più tardi." },
				values: rawData
			});
		}
	},

	cancel: async ({ request, params, locals }) => {
		const admin = locals.admin;

		if (!admin) {
			return fail(401, { cancelError: 'Non autorizzato' });
		}

		const formData = await request.formData();
		const membershipId = formData.get('membershipId');

		if (!membershipId || typeof membershipId !== 'string') {
			return fail(400, { cancelError: 'ID membership mancante' });
		}

		try {
			const result = await cancelMembership(membershipId, admin.id);

			logger.info(
				{ userId: params.id, membershipId, adminEmail: admin.email, previousNumber: result.previousNumber },
				'Admin canceled membership'
			);

			return { cancelSuccess: true, previousNumber: result.previousNumber };
		} catch (err) {
			logger.error({ err, membershipId }, 'Error canceling membership');

			const message = err instanceof Error ? err.message : 'Errore durante la cancellazione';
			return fail(500, { cancelError: message });
		}
	},

	updateStatus: async ({ request, locals }) => {
		const admin = locals.admin;

		if (!admin) {
			return fail(401, { statusError: 'Non autorizzato' });
		}

		const formData = await request.formData();
		const membershipId = formData.get('membershipId');
		const newStatus = formData.get('status');
		const newPaymentStatus = formData.get('paymentStatus');

		if (!membershipId || typeof membershipId !== 'string') {
			return fail(400, { statusError: 'ID membership mancante' });
		}

		// Validate status values
		const validStatuses = ['PENDING', 'ACTIVE', 'EXPIRED', 'CANCELED'];
		const validPaymentStatuses = ['PENDING', 'SUCCEEDED', 'FAILED'];

		if (newStatus && !validStatuses.includes(newStatus as string)) {
			return fail(400, { statusError: 'Stato non valido' });
		}

		if (newPaymentStatus && !validPaymentStatuses.includes(newPaymentStatus as string)) {
			return fail(400, { statusError: 'Stato pagamento non valido' });
		}

		try {
			const membership = await prisma.membership.findUnique({
				where: { id: membershipId }
			});

			if (!membership) {
				return fail(404, { statusError: 'Membership non trovata' });
			}

			const updateData: Record<string, unknown> = {
				updatedBy: admin.id
			};

			if (newStatus) {
				updateData.status = newStatus as MembershipStatus;
			}

			if (newPaymentStatus) {
				updateData.paymentStatus = newPaymentStatus;
			}

			await prisma.membership.update({
				where: { id: membershipId },
				data: updateData
			});

			logger.info(
				{ membershipId, adminEmail: admin.email, newStatus, newPaymentStatus },
				'Admin updated membership status'
			);

			return { statusSuccess: true };
		} catch (err) {
			logger.error({ err, membershipId }, 'Error updating membership status');
			return fail(500, { statusError: 'Errore durante l\'aggiornamento dello stato' });
		}
	},

	updateNumber: async ({ request, params, locals }) => {
		const admin = locals.admin;

		if (!admin) {
			return fail(401, { numberError: 'Non autorizzato' });
		}

		const formData = await request.formData();
		const membershipId = formData.get('membershipId');
		const newNumber = formData.get('membershipNumber');

		if (!membershipId || typeof membershipId !== 'string') {
			return fail(400, { numberError: 'ID membership mancante' });
		}

		if (!newNumber || typeof newNumber !== 'string' || !newNumber.trim()) {
			return fail(400, { numberError: 'Numero tessera obbligatorio' });
		}

		const trimmedNumber = newNumber.trim();

		try {
			// Check if number is already assigned to another membership
			const existing = await prisma.membership.findFirst({
				where: {
					membershipNumber: trimmedNumber,
					id: { not: membershipId }
				},
				include: { user: { select: { email: true } } }
			});

			if (existing) {
				return fail(409, {
					numberError: `Il numero ${trimmedNumber} è già assegnato a ${existing.user.email}`
				});
			}

			const membership = await prisma.membership.findUnique({
				where: { id: membershipId }
			});

			if (!membership) {
				return fail(404, { numberError: 'Membership non trovata' });
			}

			await prisma.membership.update({
				where: { id: membershipId },
				data: {
					membershipNumber: trimmedNumber,
					updatedBy: admin.id
				}
			});

			logger.info(
				{
					userId: params.id,
					membershipId,
					adminEmail: admin.email,
					oldNumber: membership.membershipNumber,
					newNumber: trimmedNumber
				},
				'Admin updated membership number'
			);

			return { numberSuccess: true };
		} catch (err) {
			logger.error({ err, membershipId }, 'Error updating membership number');
			return fail(500, { numberError: "Errore durante l'aggiornamento del numero tessera" });
		}
	},

	removeNumber: async ({ request, params, locals }) => {
		const admin = locals.admin;

		if (!admin) {
			return fail(401, { numberError: 'Non autorizzato' });
		}

		const formData = await request.formData();
		const membershipId = formData.get('membershipId');

		if (!membershipId || typeof membershipId !== 'string') {
			return fail(400, { numberError: 'ID membership mancante' });
		}

		try {
			const membership = await prisma.membership.findUnique({
				where: { id: membershipId }
			});

			if (!membership) {
				return fail(404, { numberError: 'Membership non trovata' });
			}

			await prisma.membership.update({
				where: { id: membershipId },
				data: {
					membershipNumber: null,
					cardAssignedAt: null,
					startDate: null,
					endDate: null,
					updatedBy: admin.id
				}
			});

			logger.info(
				{
					userId: params.id,
					membershipId,
					adminEmail: admin.email,
					removedNumber: membership.membershipNumber
				},
				'Admin removed membership number'
			);

			return { numberSuccess: true };
		} catch (err) {
			logger.error({ err, membershipId }, 'Error removing membership number');
			return fail(500, { numberError: "Errore durante la rimozione del numero tessera" });
		}
	},

	deleteUser: async ({ params, locals }) => {
		const admin = locals.admin;

		if (!admin) {
			return fail(401, { deleteError: 'Non autorizzato' });
		}

		try {
			const user = await prisma.user.findUnique({
				where: { id: params.id },
				select: { id: true, email: true }
			});

			if (!user) {
				return fail(404, { deleteError: 'Utente non trovato' });
			}

			// Cascade delete handles profile + memberships
			await prisma.user.delete({ where: { id: params.id } });

			logger.info(
				{ userId: params.id, userEmail: user.email, adminEmail: admin.email },
				'Admin deleted user'
			);
		} catch (err) {
			logger.error({ err, userId: params.id }, 'Error deleting user');
			return fail(500, { deleteError: "Errore durante l'eliminazione dell'utente" });
		}

		throw redirect(303, '/admin/users');
	},

	updateStartDate: async ({ request, locals }) => {
		const admin = locals.admin;

		if (!admin) {
			return fail(401, { dateError: 'Non autorizzato' });
		}

		const formData = await request.formData();
		const membershipId = formData.get('membershipId');
		const startDateStr = formData.get('startDate');

		if (!membershipId || typeof membershipId !== 'string') {
			return fail(400, { dateError: 'ID membership mancante' });
		}

		if (!startDateStr || typeof startDateStr !== 'string') {
			return fail(400, { dateError: 'Data inizio mancante' });
		}

		const startDate = new Date(startDateStr);
		if (isNaN(startDate.getTime())) {
			return fail(400, { dateError: 'Data non valida' });
		}

		try {
			const membership = await prisma.membership.findUnique({
				where: { id: membershipId }
			});

			if (!membership) {
				return fail(404, { dateError: 'Membership non trovata' });
			}

			const endDate = calculateEndDate(startDate);

			await prisma.membership.update({
				where: { id: membershipId },
				data: {
					startDate,
					endDate,
					updatedBy: admin.id
				}
			});

			logger.info(
				{ membershipId, adminEmail: admin.email, startDate: startDateStr, endDate: endDate.toISOString() },
				'Admin updated membership start date'
			);

			return { dateSuccess: true };
		} catch (err) {
			logger.error({ err, membershipId }, 'Error updating membership start date');
			return fail(500, { dateError: 'Errore durante l\'aggiornamento della data' });
		}
	}
} satisfies Actions;
