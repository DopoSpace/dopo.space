/**
 * Admin Users Export Endpoint
 *
 * Exports user data in CSV, Excel, or AICS format
 * Supports filtering by search, membership status, and date range
 *
 * Formats:
 * - csv: Standard CSV export with all user data
 * - xlsx: Excel export with all user data
 * - aics: AICS import format for Italian sports association registry
 */

import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { prisma } from '$lib/server/db/prisma';
import ExcelJS from 'exceljs';
import type { MembershipStatus } from '@prisma/client';
import { createLogger } from '$lib/server/utils/logger';
import { extractGenderFromTaxCode, normalizeOmocodia, validateTaxCodeFormat } from '$lib/server/utils/tax-code';
import { PROVINCE_CAP_INFO, getCityFromCap } from '$lib/server/data/italian-cap';
import { getOfficialComuneName, isValidComuneAICS, findComuneByCatastale, searchComuni } from '$lib/server/data/aics-comuni';

const logger = createLogger({ module: 'admin-export' });

/**
 * Valid Italian province codes (ISTAT)
 * Used to detect when city/province fields are swapped
 */
const ITALIAN_PROVINCES = new Set([
	'AG', 'AL', 'AN', 'AO', 'AR', 'AP', 'AT', 'AV', 'BA', 'BT', 'BL', 'BN', 'BG', 'BI', 'BO', 'BZ',
	'BS', 'BR', 'CA', 'CL', 'CB', 'CI', 'CE', 'CT', 'CZ', 'CH', 'CO', 'CS', 'CR', 'KR', 'CN', 'EN',
	'FM', 'FE', 'FI', 'FG', 'FC', 'FR', 'GE', 'GO', 'GR', 'IM', 'IS', 'SP', 'AQ', 'LT', 'LE', 'LC',
	'LI', 'LO', 'LU', 'MC', 'MN', 'MS', 'MT', 'ME', 'MI', 'MO', 'MB', 'NA', 'NO', 'NU', 'OG', 'OT',
	'OR', 'PD', 'PA', 'PR', 'PV', 'PG', 'PU', 'PE', 'PC', 'PI', 'PT', 'PN', 'PZ', 'PO', 'RG', 'RA',
	'RC', 'RE', 'RI', 'RN', 'RM', 'RO', 'SA', 'SS', 'SV', 'SI', 'SR', 'SO', 'SU', 'TA', 'TE', 'TR',
	'TO', 'TP', 'TN', 'TV', 'TS', 'UD', 'VA', 'VE', 'VB', 'VC', 'VR', 'VV', 'VI', 'VT',
	'EE' // Foreign
]);

/**
 * Check if a value looks like an Italian province code
 */
function isProvinceCode(value: string | null | undefined): boolean {
	if (!value) return false;
	const upper = value.trim().toUpperCase();
	return upper.length === 2 && ITALIAN_PROVINCES.has(upper);
}

/**
 * Get province code from CAP (postal code)
 *
 * Italian CAPs have province-specific prefixes, but some provinces share prefixes:
 * - Milano (MI) and Monza-Brianza (MB) both use 20xxx
 * - Lodi (LO) and Cremona (CR) both use 26xxx
 *
 * Strategy:
 * 1. First check if CAP falls within any capoluogo's specific range
 * 2. Fall back to prefix-based lookup (prefers larger cities)
 */
function getProvinceFromCap(cap: string | null | undefined): string | null {
	if (!cap) return null;
	const normalized = cap.replace(/\D/g, '').padStart(5, '0');
	if (normalized.length < 5) return null;

	const capNum = parseInt(normalized, 10);
	const prefix = normalized.slice(0, 2);

	// Find all provinces matching this CAP prefix
	const matchingProvinces: Array<{ code: string; info: typeof PROVINCE_CAP_INFO[string] }> = [];
	for (const [code, info] of Object.entries(PROVINCE_CAP_INFO)) {
		if (info.capPrefix === prefix) {
			matchingProvinces.push({ code, info });
		}
	}

	if (matchingProvinces.length === 0) {
		return null;
	}

	// If only one province matches, use it
	if (matchingProvinces.length === 1) {
		return matchingProvinces[0].code;
	}

	// Multiple provinces share this prefix - check CAP ranges
	for (const { code, info } of matchingProvinces) {
		// Check if CAP is in the capoluogo range
		if (capNum >= info.capMin && capNum <= info.capMax) {
			return code;
		}

		// Check extended ranges for major cities
		// Milano: 20100-20199
		if (code === 'MI' && capNum >= 20100 && capNum <= 20199) {
			return 'MI';
		}
		// Monza: 20900-20999
		if (code === 'MB' && capNum >= 20900 && capNum <= 20999) {
			return 'MB';
		}
	}

	// Fallback: return the first (typically larger/more common) province
	// Sort by capoluogo name to ensure consistent ordering
	matchingProvinces.sort((a, b) => a.info.capoluogo.localeCompare(b.info.capoluogo));

	// Prefer Milano over Monza for 20xxx range
	const miMatch = matchingProvinces.find(p => p.code === 'MI');
	if (miMatch && prefix === '20') {
		return 'MI';
	}

	return matchingProvinces[0].code;
}

/**
 * Fix residence data for AICS export
 *
 * Flow:
 * 1. If no residence data (city, province, CAP all empty) → return empty (NOT "XX")
 * 2. Use CAP to derive/correct province (most reliable source)
 * 3. If city is a province code, try to derive city from CAP or use capoluogo
 * 4. If only province provided → use capoluogo as comune
 * 5. Validate comune/province against AICS database
 * 6. If validation fails → remove ALL residence data (return empty)
 */
function fixResidenceData(
	city: string | null | undefined,
	province: string | null | undefined,
	cap: string | null | undefined
): { city: string; province: string; correctionApplied: string | null } {
	let cityVal = city?.trim() || '';
	let provinceVal = province?.trim().toUpperCase() || '';
	const capVal = cap?.trim() || '';
	const corrections: string[] = [];

	// 1. If no residence data at all, return empty (NOT "XX")
	if (!cityVal && !provinceVal && !capVal) {
		return { city: '', province: '', correctionApplied: null };
	}

	// 2. Use CAP to derive province (most reliable source)
	const derivedProvince = getProvinceFromCap(capVal);
	if (derivedProvince) {
		if (provinceVal && provinceVal !== derivedProvince) {
			corrections.push(`Provincia corretta da "${provinceVal}" a "${derivedProvince}" (da CAP ${capVal})`);
		}
		provinceVal = derivedProvince;
	}

	// 3. If city is a province code (corrupted data), try to fix it
	if (isProvinceCode(cityVal)) {
		const derivedCity = capVal ? getCityFromCap(capVal, provinceVal) : null;
		if (derivedCity) {
			corrections.push(`Comune "${cityVal}" era codice provincia, derivato da CAP: ${derivedCity}`);
			cityVal = derivedCity;
		} else if (provinceVal && PROVINCE_CAP_INFO[provinceVal]) {
			// Use capoluogo as fallback
			const capoluogo = PROVINCE_CAP_INFO[provinceVal].capoluogo;
			corrections.push(`Comune "${cityVal}" era codice provincia, usato capoluogo: ${capoluogo}`);
			cityVal = capoluogo;
		} else {
			// Cannot fix - clear residence
			corrections.push(`Comune "${cityVal}" è codice provincia, impossibile correggere - rimosso`);
			return { city: '', province: '', correctionApplied: corrections.join('; ') };
		}
	}

	// 4. If city is empty but we have province → use capoluogo
	if (!cityVal && provinceVal) {
		// Try to derive from CAP first
		const derivedCity = capVal ? getCityFromCap(capVal, provinceVal) : null;
		if (derivedCity) {
			cityVal = derivedCity;
			corrections.push(`Comune mancante, derivato da CAP: ${derivedCity}`);
		} else if (PROVINCE_CAP_INFO[provinceVal]) {
			// Use capoluogo
			const capoluogo = PROVINCE_CAP_INFO[provinceVal].capoluogo;
			cityVal = capoluogo;
			corrections.push(`Comune mancante, usato capoluogo: ${capoluogo}`);
		} else {
			// Invalid province, no CAP → clear residence
			corrections.push(`Provincia "${provinceVal}" senza comune valido - rimosso`);
			return { city: '', province: '', correctionApplied: corrections.join('; ') };
		}
	}

	// 5. Normalize city name to official AICS format
	if (cityVal && provinceVal) {
		const officialName = getOfficialComuneName(cityVal, provinceVal);
		if (officialName && officialName !== cityVal) {
			corrections.push(`Comune normalizzato: "${cityVal}" → "${officialName}"`);
			cityVal = officialName;
		}
	}

	// 6. Final validation against AICS database
	// Note: We don't validate EE (foreign) provinces
	if (provinceVal && provinceVal !== 'EE' && cityVal) {
		if (!isValidComuneAICS(cityVal, provinceVal)) {
			// Comune/Provincia not valid in AICS → clear all residence data
			corrections.push(`Comune "${cityVal}" non valido per provincia "${provinceVal}" in AICS - rimosso`);
			return { city: '', province: '', correctionApplied: corrections.join('; ') };
		}
	}

	// 7. Final check: we need both city and province, or neither
	if (!cityVal || !provinceVal) {
		if (cityVal || provinceVal) {
			corrections.push('Dati residenza incompleti - rimosso');
		}
		return { city: '', province: '', correctionApplied: corrections.length > 0 ? corrections.join('; ') : null };
	}

	return {
		city: cityVal,
		province: provinceVal,
		correctionApplied: corrections.length > 0 ? corrections.join('; ') : null
	};
}

/**
 * Extract birth place from Italian Tax Code (Codice Fiscale)
 *
 * The cadastral code is at positions 11-14 (0-indexed) of the CF.
 * We use this to look up the official comune name and province.
 *
 * @param cf - The tax code
 * @returns Object with birthCity and birthProvince, or null values if not found
 */
function extractBirthPlaceFromCF(cf: string | null | undefined): {
	birthCity: string | null;
	birthProvince: string | null;
} {
	if (!cf || !validateTaxCodeFormat(cf)) {
		return { birthCity: null, birthProvince: null };
	}

	const normalized = normalizeOmocodia(cf.toUpperCase());

	// Cadastral code is at positions 11-14 (4 characters)
	const cadastralCode = normalized.substring(11, 15);

	// Look up the comune in AICS database
	const comune = findComuneByCatastale(cadastralCode);

	if (comune) {
		return {
			birthCity: comune.comune,
			birthProvince: comune.provinciaCode
		};
	}

	// Special case: foreign birth place (cadastral code starts with 'Z')
	if (cadastralCode.startsWith('Z')) {
		return {
			birthCity: null, // Foreign city not in our database
			birthProvince: 'EE' // Foreign province code
		};
	}

	return { birthCity: null, birthProvince: null };
}

/**
 * Truncate string to max length (for AICS field limits)
 */
function truncate(str: string | null | undefined, max: number): string {
	if (!str) return '';
	return str.slice(0, max);
}

/**
 * Format phone number for AICS export
 * AICS requires max 12 characters, only digits
 */
function formatPhoneForAICS(phone: string | null | undefined): string {
	if (!phone) return '';
	// Remove all non-digit characters
	const digits = phone.replace(/\D/g, '');
	// Remove Italian country prefix if present
	if (digits.startsWith('39') && digits.length > 10) {
		return digits.slice(2).slice(0, 12);
	}
	return digits.slice(0, 12);
}

/**
 * Format date as DD/MM/YYYY (Italian format)
 */
function formatDateIT(date: Date | null | undefined): string {
	if (!date) return '';
	const d = new Date(date);
	const day = d.getDate().toString().padStart(2, '0');
	const month = (d.getMonth() + 1).toString().padStart(2, '0');
	const year = d.getFullYear();
	return `${day}/${month}/${year}`;
}

/**
 * Apply standard header styling to a worksheet
 */
function styleHeaderRow(worksheet: ExcelJS.Worksheet): void {
	const headerRow = worksheet.getRow(1);
	headerRow.font = { bold: true };
	headerRow.fill = {
		type: 'pattern',
		pattern: 'solid',
		fgColor: { argb: 'FFE0E0E0' }
	};
	headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
}

export const GET: RequestHandler = async ({ locals, url }) => {
	// Verify admin authentication
	const admin = locals.admin;
	if (!admin) {
		throw redirect(303, '/login');
	}

	try {
		// Parse query parameters
		const format = url.searchParams.get('format') || 'csv';
		const rawSearch = url.searchParams.get('search') || '';
		const search = rawSearch.trim().slice(0, 100).replace(/[<>]/g, '');
		const statusFilter = url.searchParams.get('status') as MembershipStatus | null;
		const dateFrom = url.searchParams.get('dateFrom') || null;
		const dateTo = url.searchParams.get('dateTo') || null;

		// Parse userIds - comma-separated list of user IDs to export
		const userIdsParam = url.searchParams.get('userIds') || '';
		const userIds = userIdsParam ? userIdsParam.split(',').filter(id => id.trim()) : [];

		logger.info({
			admin: admin.email,
			format,
			search,
			statusFilter,
			dateFrom,
			dateTo,
			userIdsCount: userIds.length
		}, 'Export requested');

		// Build where clause for users
		const whereClause: any = {};

		// If specific userIds provided, filter by those
		if (userIds.length > 0) {
			whereClause.id = { in: userIds };
		}

		// Text search (only if no specific userIds)
		if (search && userIds.length === 0) {
			whereClause.OR = [
				{ email: { contains: search, mode: 'insensitive' as const } },
				{ profile: { firstName: { contains: search, mode: 'insensitive' as const } } },
				{ profile: { lastName: { contains: search, mode: 'insensitive' as const } } }
			];
		}

		// Date range filter (with validation, only if no specific userIds)
		if ((dateFrom || dateTo) && userIds.length === 0) {
			whereClause.createdAt = {};
			if (dateFrom) {
				const parsedDateFrom = new Date(dateFrom);
				if (!isNaN(parsedDateFrom.getTime())) {
					whereClause.createdAt.gte = parsedDateFrom;
				} else {
					logger.warn({ dateFrom }, 'Invalid dateFrom parameter, ignoring');
				}
			}
			if (dateTo) {
				const parsedDateTo = new Date(dateTo);
				if (!isNaN(parsedDateTo.getTime())) {
					whereClause.createdAt.lte = parsedDateTo;
				} else {
					logger.warn({ dateTo }, 'Invalid dateTo parameter, ignoring');
				}
			}
			// Remove empty createdAt if both dates were invalid
			if (Object.keys(whereClause.createdAt).length === 0) {
				delete whereClause.createdAt;
			}
		}

		// Fetch users with all related data
		const users = await prisma.user.findMany({
			where: whereClause,
			include: {
				profile: true,
				memberships: {
					orderBy: {
						createdAt: 'desc'
					}
				}
			},
			orderBy: {
				createdAt: 'desc'
			}
		});

		// Apply membership filters if specified
		let filteredUsers = users;
		if (statusFilter) {
			filteredUsers = users.filter((user) => {
				const latestMembership = user.memberships[0];
				if (!latestMembership) return false;

				if (statusFilter && latestMembership.status !== statusFilter) {
					return false;
				}

				return true;
			});
		}

		// Transform data for export
		const exportData = filteredUsers.map((user) => {
			const profile = user.profile;
			const latestMembership = user.memberships[0];

			return {
				// User basic info
				email: user.email,
				phone: user.phone || '',
				newsletterSubscribed: user.newsletterSubscribed ? 'Yes' : 'No',
				registrationDate: user.createdAt.toISOString().split('T')[0],
				lastUpdated: user.updatedAt.toISOString().split('T')[0],

				// Profile info
				firstName: profile?.firstName || '',
				lastName: profile?.lastName || '',
				birthDate: profile?.birthDate ? profile.birthDate.toISOString().split('T')[0] : '',
				taxCode: profile?.taxCode || '',
				address: profile?.address || '',
				city: profile?.city || '',
				postalCode: profile?.postalCode || '',
				province: profile?.province || '',
				documentType: profile?.documentType || '',
				documentNumber: profile?.documentNumber || '',
				privacyConsent: profile?.privacyConsent === null ? '' : profile?.privacyConsent ? 'Yes' : 'No',
				dataConsent: profile?.dataConsent === null ? '' : profile?.dataConsent ? 'Yes' : 'No',
				profileComplete: profile?.profileComplete ? 'Yes' : 'No',

				// Membership info
				membershipNumber: latestMembership?.membershipNumber || '',
				membershipStatus: latestMembership?.status || '',
				paymentStatus: latestMembership?.paymentStatus || '',
				membershipStartDate: latestMembership?.startDate
					? latestMembership.startDate.toISOString().split('T')[0]
					: '',
				membershipEndDate: latestMembership?.endDate
					? latestMembership.endDate.toISOString().split('T')[0]
					: '',
				paymentAmount: latestMembership?.paymentAmount
					? `€${(latestMembership.paymentAmount / 100).toFixed(2)}`
					: ''
			};
		});

		const timestamp = new Date().toISOString().split('T')[0];
		const filename = `users-export-${timestamp}`;

		// Generate output based on format
		if (format === 'aics') {
			// AICS format for Italian sports association import
			const aicsResult = generateAICSData(filteredUsers);

			logger.info({
				totalUsers: filteredUsers.length,
				includedUsers: aicsResult.included.length,
				excludedUsers: aicsResult.excluded.length
			}, 'AICS export generated');

			const buffer = await generateAICSExcel(aicsResult);
			return new Response(new Uint8Array(buffer), {
				headers: {
					'Content-Type':
						'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
					'Content-Disposition': `attachment; filename="aics-export-${timestamp}.xlsx"`
				}
			});
		} else if (format === 'xlsx') {
			const buffer = await generateExcel(exportData);
			return new Response(new Uint8Array(buffer), {
				headers: {
					'Content-Type':
						'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
					'Content-Disposition': `attachment; filename="${filename}.xlsx"`
				}
			});
		} else {
			const csv = generateCSV(exportData);
			return new Response(csv, {
				headers: {
					'Content-Type': 'text/csv; charset=utf-8',
					'Content-Disposition': `attachment; filename="${filename}.csv"`
				}
			});
		}
	} catch (error) {
		logger.error({ error }, 'Export failed');
		return new Response('Export failed', { status: 500 });
	}
};

/**
 * POST handler for export (handles large number of user IDs via body)
 */
export const POST: RequestHandler = async ({ locals, request }) => {
	// Verify admin authentication
	const admin = locals.admin;
	if (!admin) {
		throw redirect(303, '/login');
	}

	try {
		// Parse JSON body
		const body = await request.json();
		const format = body.format || 'csv';
		const userIds: string[] = body.userIds || [];

		logger.info({
			admin: admin.email,
			format,
			userIdsCount: userIds.length
		}, 'Export requested (POST)');

		// Build where clause for users
		const whereClause: any = {};
		if (userIds.length > 0) {
			whereClause.id = { in: userIds };
		}

		// Fetch users with related data
		const users = await prisma.user.findMany({
			where: whereClause,
			include: {
				profile: true,
				memberships: {
					orderBy: { createdAt: 'desc' }
				}
			}
		});

		// Apply userIds order if provided
		let filteredUsers = users;
		if (userIds.length > 0) {
			const userMap = new Map(users.map(u => [u.id, u]));
			filteredUsers = userIds.map(id => userMap.get(id)).filter((u): u is typeof users[0] => u !== undefined);
		}

		// Map users to export format
		const exportData = filteredUsers.map((user) => {
			const profile = user.profile;
			const latestMembership = user.memberships[0];

			return {
				email: user.email,
				phone: user.phone || '',
				newsletterSubscribed: user.newsletterSubscribed ? 'Yes' : 'No',
				registeredAt: user.createdAt.toISOString().split('T')[0],
				updatedAt: user.updatedAt.toISOString().split('T')[0],

				firstName: profile?.firstName || '',
				lastName: profile?.lastName || '',
				birthDate: profile?.birthDate ? profile.birthDate.toISOString().split('T')[0] : '',
				birthCity: profile?.birthCity || '',
				birthProvince: profile?.birthProvince || '',
				nationality: profile?.nationality || 'IT',
				taxCode: profile?.taxCode || '',
				gender: profile?.gender || '',

				address: profile?.address || '',
				city: profile?.city || '',
				postalCode: profile?.postalCode || '',
				province: profile?.province || '',
				country: profile?.residenceCountry || 'IT',

				profileComplete: profile?.profileComplete ? 'Yes' : 'No',

				membershipNumber: latestMembership?.membershipNumber || '',
				membershipStatus: latestMembership?.status || '',
				paymentStatus: latestMembership?.paymentStatus || '',
				membershipStartDate: latestMembership?.startDate
					? latestMembership.startDate.toISOString().split('T')[0]
					: '',
				membershipEndDate: latestMembership?.endDate
					? latestMembership.endDate.toISOString().split('T')[0]
					: '',
				paymentAmount: latestMembership?.paymentAmount
					? `€${(latestMembership.paymentAmount / 100).toFixed(2)}`
					: ''
			};
		});

		// Generate filename
		const now = new Date();
		const timestamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
		const filename = `users-export-${timestamp}`;

		// Generate output based on format
		if (format === 'aics') {
			const aicsResult = generateAICSData(filteredUsers);
			logger.info({
				totalUsers: filteredUsers.length,
				includedUsers: aicsResult.included.length,
				excludedUsers: aicsResult.excluded.length
			}, 'AICS export generated (POST)');

			const buffer = await generateAICSExcel(aicsResult);
			return new Response(new Uint8Array(buffer), {
				headers: {
					'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
					'Content-Disposition': `attachment; filename="aics-export-${timestamp}.xlsx"`
				}
			});
		} else if (format === 'xlsx') {
			const buffer = await generateExcel(exportData);
			return new Response(new Uint8Array(buffer), {
				headers: {
					'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
					'Content-Disposition': `attachment; filename="${filename}.xlsx"`
				}
			});
		} else {
			const csv = generateCSV(exportData);
			return new Response(csv, {
				headers: {
					'Content-Type': 'text/csv; charset=utf-8',
					'Content-Disposition': `attachment; filename="${filename}.csv"`
				}
			});
		}
	} catch (error) {
		logger.error({ error }, 'Export failed (POST)');
		return new Response('Export failed', { status: 500 });
	}
};

/**
 * Generate CSV from export data
 */
function generateCSV(data: any[]): string {
	if (data.length === 0) {
		return 'No data to export';
	}

	// Define headers
	const headers = [
		'Email',
		'Phone',
		'Newsletter Subscribed',
		'Registration Date',
		'Last Updated',
		'First Name',
		'Last Name',
		'Birth Date',
		'Tax Code',
		'Address',
		'City',
		'Postal Code',
		'Province',
		'Document Type',
		'Document Number',
		'Privacy Consent',
		'Data Consent',
		'Profile Complete',
		'Membership Number',
		'Membership Status',
		'Payment Status',
		'Membership Start Date',
		'Membership End Date',
		'Payment Amount'
	];

	// Build CSV rows
	const rows = data.map((row) => {
		return [
			escapeCsvValue(row.email),
			escapeCsvValue(row.phone),
			escapeCsvValue(row.newsletterSubscribed),
			escapeCsvValue(row.registrationDate),
			escapeCsvValue(row.lastUpdated),
			escapeCsvValue(row.firstName),
			escapeCsvValue(row.lastName),
			escapeCsvValue(row.birthDate),
			escapeCsvValue(row.taxCode),
			escapeCsvValue(row.address),
			escapeCsvValue(row.city),
			escapeCsvValue(row.postalCode),
			escapeCsvValue(row.province),
			escapeCsvValue(row.documentType),
			escapeCsvValue(row.documentNumber),
			escapeCsvValue(row.privacyConsent),
			escapeCsvValue(row.dataConsent),
			escapeCsvValue(row.profileComplete),
			escapeCsvValue(row.membershipNumber),
			escapeCsvValue(row.membershipStatus),
			escapeCsvValue(row.paymentStatus),
			escapeCsvValue(row.membershipStartDate),
			escapeCsvValue(row.membershipEndDate),
			escapeCsvValue(row.paymentAmount)
		].join(',');
	});

	return [headers.join(','), ...rows].join('\n');
}

/**
 * Escape CSV values to handle commas, quotes, and newlines
 */
function escapeCsvValue(value: string): string {
	if (value === null || value === undefined) {
		return '';
	}
	const stringValue = String(value);
	// If value contains comma, quote, or newline, wrap in quotes and escape quotes
	if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
		return `"${stringValue.replace(/"/g, '""')}"`;
	}
	return stringValue;
}

/**
 * Generate Excel file from export data
 */
async function generateExcel(data: any[]): Promise<Buffer> {
	const workbook = new ExcelJS.Workbook();
	const worksheet = workbook.addWorksheet('Users Export');

	// Define columns with headers and widths
	worksheet.columns = [
		{ header: 'Email', key: 'email', width: 30 },
		{ header: 'Phone', key: 'phone', width: 15 },
		{ header: 'Newsletter Subscribed', key: 'newsletterSubscribed', width: 20 },
		{ header: 'Registration Date', key: 'registrationDate', width: 18 },
		{ header: 'Last Updated', key: 'lastUpdated', width: 18 },
		{ header: 'First Name', key: 'firstName', width: 20 },
		{ header: 'Last Name', key: 'lastName', width: 20 },
		{ header: 'Birth Date', key: 'birthDate', width: 15 },
		{ header: 'Tax Code', key: 'taxCode', width: 20 },
		{ header: 'Address', key: 'address', width: 30 },
		{ header: 'City', key: 'city', width: 20 },
		{ header: 'Postal Code', key: 'postalCode', width: 12 },
		{ header: 'Province', key: 'province', width: 12 },
		{ header: 'Document Type', key: 'documentType', width: 18 },
		{ header: 'Document Number', key: 'documentNumber', width: 20 },
		{ header: 'Privacy Consent', key: 'privacyConsent', width: 18 },
		{ header: 'Data Consent', key: 'dataConsent', width: 15 },
		{ header: 'Profile Complete', key: 'profileComplete', width: 18 },
		{ header: 'Membership Number', key: 'membershipNumber', width: 20 },
		{ header: 'Membership Status', key: 'membershipStatus', width: 18 },
		{ header: 'Payment Status', key: 'paymentStatus', width: 18 },
		{ header: 'Membership Start Date', key: 'membershipStartDate', width: 20 },
		{ header: 'Membership End Date', key: 'membershipEndDate', width: 20 },
		{ header: 'Payment Amount', key: 'paymentAmount', width: 15 }
	];

	styleHeaderRow(worksheet);
	data.forEach((row) => worksheet.addRow(row));

	worksheet.autoFilter = { from: 'A1', to: `X${data.length + 1}` };
	worksheet.views = [{ state: 'frozen', ySplit: 1 }];

	const buffer = await workbook.xlsx.writeBuffer();
	return Buffer.from(buffer);
}

/**
 * AICS export data structure
 */
interface AICSRow {
	cognome: string;
	nome: string;
	sesso: string;
	dataNascita: string;
	provinciaNascita: string;
	comuneNascita: string;
	codiceFiscale: string;
	indirizzo: string;
	cap: string;
	provincia: string;
	comune: string;
	telefonoAbitazione: string;
	faxAbitazione: string;
	telefonoUfficio: string;
	faxUfficio: string;
	cellulare: string;
	email: string;
	qualificaSociale: string;
	attivitaSociale: string;
	qualificaSportiva: string;
	attivitaSportiva: string;
	tipoCertificato: string;
	dataRilascioCert: string;
	dataScadenzaCert: string;
	numeroTessera: string;
	dataRilascioTessera: string;
}

/**
 * AICS export result with included and excluded users
 */
interface AICSExportResult {
	included: AICSRow[];
	excluded: Array<{
		email: string;
		firstName: string;
		lastName: string;
		reasons: string[];
	}>;
}

/**
 * Transform user data to AICS format
 *
 * AICS column mapping:
 * - COGNOME: Last name
 * - NOME: First name
 * - SESSO: Gender (deduced from tax code, M/F)
 * - DATA NASCITA: Birth date (DD/MM/YYYY)
 * - PROVINCIA NASCITA: Birth province (2 letters or EE for foreign)
 * - COMUNE NASCITA: Birth city
 * - CODICE FISCALE: Tax code or 16 zeros for foreigners without CF
 * - INDIRIZZO: Address
 * - CAP: Postal code
 * - COMUNE: City (residence)
 * - PROVINCIA: Province (residence)
 * - TELEFONO ABITAZIONE: Empty
 * - FAX ABITAZIONE: Empty
 * - TELEFONO UFFICIO: Empty
 * - FAX UFFICIO: Empty
 * - CELLULARE: Mobile phone
 * - EMAIL: Email
 * - QUALIFICA SOCIALE: "SO" (fixed code for Socio)
 * - ATTIVITÀ SOCIALE: "C0001" (fixed)
 * - QUALIFICA SPORTIVA: Empty
 * - ATTIVITÀ SPORTIVA: Empty
 * - TIPO CERTIFICATO: Empty
 * - DATA RILASCIO CERT: Empty
 * - DATA SCADENZA CERT: Empty
 * - NUMERO TESSERA: Membership number
 * - DATA RILASCIO TESSERA: Card assignment date (DD/MM/YYYY)
 */
function generateAICSData(users: any[]): AICSExportResult {
	const included: AICSRow[] = [];
	const excluded: AICSExportResult['excluded'] = [];

	for (const user of users) {
		const profile = user.profile;
		const membership = user.memberships[0];
		const reasons: string[] = [];

		// Check exclusion reasons
		if (!membership) {
			reasons.push('Nessuna membership');
		} else {
			if (!membership.membershipNumber) {
				reasons.push('Numero tessera non assegnato');
			}
			if (membership.status !== 'ACTIVE') {
				const statusLabels: Record<string, string> = {
					PENDING: 'In attesa',
					EXPIRED: 'Scaduta',
					CANCELED: 'Cancellata'
				};
				reasons.push(`Stato: ${statusLabels[membership.status] || membership.status}`);
			}
		}

		if (reasons.length > 0) {
			// User excluded
			excluded.push({
				email: user.email,
				firstName: profile?.firstName || '',
				lastName: profile?.lastName || '',
				reasons
			});
		} else {
			// User included - transform to AICS format
			const isItalian = profile?.nationality === 'IT' || !profile?.nationality;
			const hasForeignCF = profile?.hasForeignTaxCode === true;
			const taxCode = (isItalian || hasForeignCF) ? (profile?.taxCode || '') : '';

			// Determine gender: first try from tax code, then fallback to profile.gender
			let sesso = '';
			if (taxCode) {
				sesso = extractGenderFromTaxCode(taxCode) || '';
			}
			if (!sesso && profile?.gender) {
				sesso = profile.gender;
			}

			// Fix birth place - ALWAYS derive from CF when available (requirements #4 and #5)
			// CF has priority over database values
			let birthCity = profile?.birthCity || '';
			let birthProvince = profile?.birthProvince || '';

			if (taxCode) {
				const cfBirthPlace = extractBirthPlaceFromCF(taxCode);

				if (cfBirthPlace.birthCity && cfBirthPlace.birthProvince) {
					// CF provides valid birth place - use it (overrides database)
					if (birthCity !== cfBirthPlace.birthCity || birthProvince !== cfBirthPlace.birthProvince) {
						logger.info(
							{
								email: user.email,
								originalCity: birthCity,
								originalProvince: birthProvince,
								cfCity: cfBirthPlace.birthCity,
								cfProvince: cfBirthPlace.birthProvince
							},
							'Birth place corrected from CF for AICS export'
						);
					}
					birthCity = cfBirthPlace.birthCity;
					birthProvince = cfBirthPlace.birthProvince;
				} else if (cfBirthPlace.birthProvince === 'EE') {
					// Foreign birth - use EE province, keep database city (country name)
					birthProvince = 'EE';
					// If no city, the foreign country should be in birthCity field
				}
			}

			// For foreign births, ensure country name matches official AICS entry
			if (birthProvince === 'EE' && birthCity) {
				const officialName = getOfficialComuneName(birthCity, 'EE');
				if (officialName) {
					if (birthCity !== officialName) {
						logger.info(
							{ email: user.email, original: birthCity, corrected: officialName },
							'Foreign birth place corrected to AICS official name'
						);
						birthCity = officialName;
					}
				} else {
					// Try partial match - if exactly one foreign entry matches, use it
					const matches = searchComuni(birthCity, 'EE', 2);
					if (matches.length === 1) {
						logger.info(
							{ email: user.email, original: birthCity, corrected: matches[0].comune },
							'Foreign birth place corrected via partial match to AICS official name'
						);
						birthCity = matches[0].comune;
					}
				}
			}

			// Fix residence data - validate against AICS and clean if invalid
			const residenceData = fixResidenceData(profile?.city, profile?.province, profile?.postalCode);
			if (residenceData.correctionApplied) {
				logger.info(
					{
						email: user.email,
						originalCity: profile?.city,
						originalProvince: profile?.province,
						cap: profile?.postalCode,
						correctedCity: residenceData.city,
						correctedProvince: residenceData.province,
						correction: residenceData.correctionApplied
					},
					'Auto-corrected residence data for AICS export'
				);
			}

			// If residence is cleared (city/province empty), also clear CAP and address
			const hasValidResidence = residenceData.city && residenceData.province;

			included.push({
				cognome: truncate(profile?.lastName, 50),
				nome: truncate(profile?.firstName, 50),
				sesso,
				dataNascita: formatDateIT(profile?.birthDate),
				provinciaNascita: birthProvince,
				comuneNascita: truncate(birthCity, 65),
				codiceFiscale: taxCode || '',
				indirizzo: hasValidResidence ? truncate(profile?.address, 50) : '',
				cap: hasValidResidence ? (profile?.postalCode || '') : '',
				provincia: residenceData.province,
				comune: truncate(residenceData.city, 65),
				telefonoAbitazione: '',
				faxAbitazione: '',
				telefonoUfficio: '',
				faxUfficio: '',
				cellulare: formatPhoneForAICS(user.phone),
				email: truncate(user.email, 50),
				qualificaSociale: 'SO',
				attivitaSociale: 'C0001',
				qualificaSportiva: '',
				attivitaSportiva: '',
				tipoCertificato: '',
				dataRilascioCert: '',
				dataScadenzaCert: '',
				numeroTessera: membership?.membershipNumber || '',
				dataRilascioTessera: formatDateIT(new Date())
			});
		}
	}

	return { included, excluded };
}

/**
 * Generate AICS Excel file
 * Matches the exact official AICS import template structure with:
 * - Row 1: Category headers with merged cells
 * - Row 2: Column sub-headers with short names
 * - Row 3+: Data
 * - Second sheet: Excluded users with reasons (if any)
 */
async function generateAICSExcel(result: AICSExportResult): Promise<Buffer> {
	const { included: data, excluded } = result;
	const workbook = new ExcelJS.Workbook();
	const worksheet = workbook.addWorksheet('Soci AICS');

	// === Category header style (row 1) ===
	const categoryStyle: Partial<ExcelJS.Style> = {
		font: { bold: true },
		fill: {
			type: 'pattern',
			pattern: 'solid',
			fgColor: { argb: 'FFE0E0E0' }
		},
		alignment: { vertical: 'middle', horizontal: 'center' },
		border: {
			top: { style: 'thin' },
			bottom: { style: 'thin' },
			left: { style: 'thin' },
			right: { style: 'thin' }
		}
	};

	// === ROW 1: Categories with merged cells ===
	// NOMINATIVO: A1-B1
	worksheet.mergeCells('A1:B1');
	worksheet.getCell('A1').value = 'NOMINATIVO';
	Object.assign(worksheet.getCell('A1'), { style: categoryStyle });

	// DATI DI NASCITA: C1-G1
	worksheet.mergeCells('C1:G1');
	worksheet.getCell('C1').value = 'DATI DI NASCITA';
	Object.assign(worksheet.getCell('C1'), { style: categoryStyle });

	// DATI DI RESIDENZA/DOMICILIO: H1-K1
	worksheet.mergeCells('H1:K1');
	worksheet.getCell('H1').value = 'DATI DI RESIDENZA/DOMICILIO';
	Object.assign(worksheet.getCell('H1'), { style: categoryStyle });

	// RECAPITI ABITAZIONE: L1-M1
	worksheet.mergeCells('L1:M1');
	worksheet.getCell('L1').value = 'RECAPITI ABITAZIONE';
	Object.assign(worksheet.getCell('L1'), { style: categoryStyle });

	// RECAPITI UFFICIO: N1-O1
	worksheet.mergeCells('N1:O1');
	worksheet.getCell('N1').value = 'RECAPITI UFFICIO';
	Object.assign(worksheet.getCell('N1'), { style: categoryStyle });

	// ALTRI RECAPITI: P1-Q1
	worksheet.mergeCells('P1:Q1');
	worksheet.getCell('P1').value = 'ALTRI RECAPITI';
	Object.assign(worksheet.getCell('P1'), { style: categoryStyle });

	// INQUADRAMENTO SOCIALE: R1-S1
	worksheet.mergeCells('R1:S1');
	worksheet.getCell('R1').value = 'INQUADRAMENTO SOCIALE';
	Object.assign(worksheet.getCell('R1'), { style: categoryStyle });

	// INQUADRAMENTO SPORTIVO: T1-U1
	worksheet.mergeCells('T1:U1');
	worksheet.getCell('T1').value = 'INQUADRAMENTO SPORTIVO';
	Object.assign(worksheet.getCell('T1'), { style: categoryStyle });

	// CERTIFICATO MEDICO: V1-X1
	worksheet.mergeCells('V1:X1');
	worksheet.getCell('V1').value = 'CERTIFICATO MEDICO';
	Object.assign(worksheet.getCell('V1'), { style: categoryStyle });

	// TESSERA: Y1-Z1
	worksheet.mergeCells('Y1:Z1');
	worksheet.getCell('Y1').value = 'TESSERA';
	Object.assign(worksheet.getCell('Y1'), { style: categoryStyle });

	// === ROW 2: Column sub-headers (short names matching AICS template) ===
	// AICS template column order:
	// J = PROVINCIA (residenza), K = COMUNE (residenza)
	const row2Headers = [
		'COGNOME',
		'NOME',
		'SESSO',
		'DATA',
		'PROVINCIA',
		'COMUNE',
		'CODICE FISCALE',
		'INDIRIZZO',
		'CAP',
		'PROVINCIA', // J - residenza PROVINCIA first
		'COMUNE', // K - residenza COMUNE second
		'TELEFONO',
		'FAX',
		'TELEFONO',
		'FAX',
		'CELLULARE',
		'EMAIL',
		'QUALIFICA',
		'ATTIVITÀ',
		'QUALIFICA',
		'ATTIVITÀ',
		'TIPO',
		'DATA RILASCIO',
		'DATA SCADENZA',
		'NUMERO',
		'DATA RILASCIO'
	];

	const headerRow = worksheet.getRow(2);
	row2Headers.forEach((header, index) => {
		const cell = headerRow.getCell(index + 1);
		cell.value = header;
		cell.font = { bold: true };
		cell.alignment = { horizontal: 'center', vertical: 'middle' };
		cell.border = {
			top: { style: 'thin' },
			bottom: { style: 'thin' },
			left: { style: 'thin' },
			right: { style: 'thin' }
		};
	});

	// === ROW 3+: Data rows ===
	// AICS template column order: J = PROVINCIA (residenza), K = COMUNE (residenza)
	data.forEach((row, index) => {
		const dataRow = worksheet.getRow(index + 3);
		dataRow.values = [
			row.cognome,
			row.nome,
			row.sesso,
			row.dataNascita,
			row.provinciaNascita,
			row.comuneNascita,
			row.codiceFiscale,
			row.indirizzo,
			row.cap,
			row.provincia, // J - residenza PROVINCIA first
			row.comune, // K - residenza COMUNE second
			row.telefonoAbitazione,
			row.faxAbitazione,
			row.telefonoUfficio,
			row.faxUfficio,
			row.cellulare,
			row.email,
			row.qualificaSociale,
			row.attivitaSociale,
			row.qualificaSportiva,
			row.attivitaSportiva,
			row.tipoCertificato,
			row.dataRilascioCert,
			row.dataScadenzaCert,
			row.numeroTessera,
			row.dataRilascioTessera
		];
	});

	// === Column widths ===
	const columnWidths = [
		20, // A: COGNOME
		20, // B: NOME
		8, // C: SESSO
		12, // D: DATA
		12, // E: PROVINCIA (nascita)
		25, // F: COMUNE (nascita)
		20, // G: CODICE FISCALE
		30, // H: INDIRIZZO
		10, // I: CAP
		12, // J: PROVINCIA (residenza)
		20, // K: COMUNE (residenza)
		15, // L: TELEFONO (abitazione)
		12, // M: FAX (abitazione)
		15, // N: TELEFONO (ufficio)
		12, // O: FAX (ufficio)
		15, // P: CELLULARE
		30, // Q: EMAIL
		12, // R: QUALIFICA (sociale)
		12, // S: ATTIVITÀ (sociale)
		12, // T: QUALIFICA (sportiva)
		12, // U: ATTIVITÀ (sportiva)
		10, // V: TIPO (certificato)
		14, // W: DATA RILASCIO (cert)
		14, // X: DATA SCADENZA (cert)
		15, // Y: NUMERO (tessera)
		14 // Z: DATA RILASCIO (tessera)
	];
	columnWidths.forEach((width, index) => {
		worksheet.getColumn(index + 1).width = width;
	});

	// === Autofilter on row 2 (header row) ===
	if (data.length > 0) {
		worksheet.autoFilter = { from: 'A2', to: `Z${data.length + 2}` };
	}

	// === Freeze first 2 rows ===
	worksheet.views = [{ state: 'frozen', ySplit: 2 }];

	// === Second sheet: Excluded users (if any) ===
	if (excluded.length > 0) {
		const excludedSheet = workbook.addWorksheet('Utenti esclusi');

		// Header style
		const warningHeaderStyle: Partial<ExcelJS.Style> = {
			font: { bold: true, color: { argb: 'FFFFFFFF' } },
			fill: {
				type: 'pattern',
				pattern: 'solid',
				fgColor: { argb: 'FFDC2626' } // Red background
			},
			alignment: { vertical: 'middle', horizontal: 'center' },
			border: {
				top: { style: 'thin' },
				bottom: { style: 'thin' },
				left: { style: 'thin' },
				right: { style: 'thin' }
			}
		};

		// Summary row
		excludedSheet.mergeCells('A1:D1');
		const summaryCell = excludedSheet.getCell('A1');
		summaryCell.value = `⚠️ ${excluded.length} utent${excluded.length === 1 ? 'e non può' : 'i non possono'} essere esportat${excluded.length === 1 ? 'o' : 'i'} per AICS`;
		summaryCell.font = { bold: true, size: 14 };
		summaryCell.alignment = { vertical: 'middle', horizontal: 'left' };
		excludedSheet.getRow(1).height = 25;

		// Headers row
		const headerRow = excludedSheet.getRow(2);
		const headers = ['Email', 'Nome', 'Cognome', 'Motivo esclusione'];
		headers.forEach((header, index) => {
			const cell = headerRow.getCell(index + 1);
			cell.value = header;
			Object.assign(cell, { style: warningHeaderStyle });
		});

		// Data rows
		excluded.forEach((user, index) => {
			const row = excludedSheet.getRow(index + 3);
			row.values = [
				user.email,
				user.firstName,
				user.lastName,
				user.reasons.join('; ')
			];

			// Light red background for data rows
			row.eachCell((cell) => {
				cell.fill = {
					type: 'pattern',
					pattern: 'solid',
					fgColor: { argb: 'FFFEE2E2' } // Light red
				};
				cell.border = {
					top: { style: 'thin', color: { argb: 'FFFCA5A5' } },
					bottom: { style: 'thin', color: { argb: 'FFFCA5A5' } },
					left: { style: 'thin', color: { argb: 'FFFCA5A5' } },
					right: { style: 'thin', color: { argb: 'FFFCA5A5' } }
				};
			});
		});

		// Column widths
		excludedSheet.getColumn(1).width = 35; // Email
		excludedSheet.getColumn(2).width = 20; // Nome
		excludedSheet.getColumn(3).width = 20; // Cognome
		excludedSheet.getColumn(4).width = 50; // Motivo

		// Autofilter
		excludedSheet.autoFilter = { from: 'A2', to: `D${excluded.length + 2}` };

		// Freeze header rows
		excludedSheet.views = [{ state: 'frozen', ySplit: 2 }];
	}

	const buffer = await workbook.xlsx.writeBuffer();
	return Buffer.from(buffer);
}
