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
import { extractGenderFromTaxCode } from '$lib/server/utils/tax-code';

const logger = createLogger({ module: 'admin-export' });

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
			const aicsData = generateAICSData(filteredUsers);
			const buffer = await generateAICSExcel(aicsData);
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
 * - PROVINCIA: Province (residence)
 * - COMUNE: City (residence)
 * - TELEFONO ABITAZIONE: Empty
 * - FAX ABITAZIONE: Empty
 * - TELEFONO UFFICIO: Empty
 * - FAX UFFICIO: Empty
 * - CELLULARE: Mobile phone
 * - EMAIL: Email
 * - QUALIFICA SOCIALE: "SOCIO" (fixed)
 * - ATTIVITÀ SOCIALE: "C0001" (fixed)
 * - QUALIFICA SPORTIVA: Empty
 * - ATTIVITÀ SPORTIVA: Empty
 * - TIPO CERTIFICATO: Empty
 * - DATA RILASCIO CERT: Empty
 * - DATA SCADENZA CERT: Empty
 * - NUMERO TESSERA: Membership number
 * - DATA RILASCIO TESSERA: Card assignment date (DD/MM/YYYY)
 */
function generateAICSData(users: any[]): AICSRow[] {
	return users
		.filter((user) => {
			// Only export users with active membership and membership number
			const membership = user.memberships[0];
			return membership?.membershipNumber && membership?.status === 'ACTIVE';
		})
		.map((user) => {
			const profile = user.profile;
			const membership = user.memberships[0];
			const taxCode = profile?.taxCode || '';

			return {
				cognome: profile?.lastName || '',
				nome: profile?.firstName || '',
				sesso: taxCode ? extractGenderFromTaxCode(taxCode) || '' : '',
				dataNascita: formatDateIT(profile?.birthDate),
				provinciaNascita: profile?.birthProvince || '',
				comuneNascita: profile?.birthCity || '',
				codiceFiscale: taxCode || '0000000000000000',
				indirizzo: profile?.address || '',
				cap: profile?.postalCode || '',
				provincia: profile?.province || '',
				comune: profile?.city || '',
				telefonoAbitazione: '',
				faxAbitazione: '',
				telefonoUfficio: '',
				faxUfficio: '',
				cellulare: profile?.phone || '',
				email: user.email || '',
				qualificaSociale: 'SOCIO',
				attivitaSociale: 'C0001',
				qualificaSportiva: '',
				attivitaSportiva: '',
				tipoCertificato: '',
				dataRilascioCert: '',
				dataScadenzaCert: '',
				numeroTessera: membership?.membershipNumber || '',
				dataRilascioTessera: formatDateIT(membership?.cardAssignedAt)
			};
		});
}

/**
 * Generate AICS Excel file
 * Matches the exact official AICS import template structure with:
 * - Row 1: Category headers with merged cells
 * - Row 2: Column sub-headers with short names
 * - Row 3+: Data
 */
async function generateAICSExcel(data: AICSRow[]): Promise<Buffer> {
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
		'PROVINCIA',
		'COMUNE',
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
			row.provincia,
			row.comune,
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

	const buffer = await workbook.xlsx.writeBuffer();
	return Buffer.from(buffer);
}
