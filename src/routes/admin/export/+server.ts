/**
 * Admin Users Export Endpoint
 *
 * Exports user data in CSV or Excel format
 * Supports filtering by search, membership status, association year, and date range
 */

import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { prisma } from '$lib/server/db/prisma';
import ExcelJS from 'exceljs';
import { MembershipStatus, PaymentStatus } from '@prisma/client';
import { createLogger } from '$lib/server/utils/logger';

const logger = createLogger({ module: 'admin-export' });

export const GET: RequestHandler = async ({ locals, url }) => {
	// Verify admin authentication
	const admin = locals.admin;
	if (!admin) {
		throw redirect(303, '/admin/login');
	}

	try {
		// Parse query parameters
		const format = url.searchParams.get('format') || 'csv';
		const rawSearch = url.searchParams.get('search') || '';
		const search = rawSearch.trim().slice(0, 100).replace(/[<>]/g, '');
		const statusFilter = url.searchParams.get('status') as MembershipStatus | null;
		const yearFilter = url.searchParams.get('year') || null;
		const dateFrom = url.searchParams.get('dateFrom') || null;
		const dateTo = url.searchParams.get('dateTo') || null;

		logger.info('Export requested', {
			admin: admin.email,
			format,
			search,
			statusFilter,
			yearFilter,
			dateFrom,
			dateTo
		});

		// Build where clause for users
		const whereClause: any = {};

		// Text search
		if (search) {
			whereClause.OR = [
				{ email: { contains: search, mode: 'insensitive' as const } },
				{ profile: { firstName: { contains: search, mode: 'insensitive' as const } } },
				{ profile: { lastName: { contains: search, mode: 'insensitive' as const } } }
			];
		}

		// Date range filter
		if (dateFrom || dateTo) {
			whereClause.createdAt = {};
			if (dateFrom) {
				whereClause.createdAt.gte = new Date(dateFrom);
			}
			if (dateTo) {
				whereClause.createdAt.lte = new Date(dateTo);
			}
		}

		// Fetch users with all related data
		const users = await prisma.user.findMany({
			where: whereClause,
			include: {
				profile: true,
				memberships: {
					include: {
						associationYear: true
					},
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
		if (statusFilter || yearFilter) {
			filteredUsers = users.filter((user) => {
				const latestMembership = user.memberships[0];
				if (!latestMembership) return false;

				if (statusFilter && latestMembership.status !== statusFilter) {
					return false;
				}

				if (yearFilter && latestMembership.associationYear.year !== yearFilter) {
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
					: '',
				associationYear: latestMembership?.associationYear?.year || ''
			};
		});

		const timestamp = new Date().toISOString().split('T')[0];
		const filename = `users-export-${timestamp}`;

		// Generate CSV or Excel based on format
		if (format === 'xlsx') {
			const buffer = await generateExcel(exportData);
			return new Response(buffer, {
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
		logger.error('Export failed', error);
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
		'Payment Amount',
		'Association Year'
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
			escapeCsvValue(row.paymentAmount),
			escapeCsvValue(row.associationYear)
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
		{ header: 'Payment Amount', key: 'paymentAmount', width: 15 },
		{ header: 'Association Year', key: 'associationYear', width: 18 }
	];

	// Style the header row
	const headerRow = worksheet.getRow(1);
	headerRow.font = { bold: true };
	headerRow.fill = {
		type: 'pattern',
		pattern: 'solid',
		fgColor: { argb: 'FFE0E0E0' }
	};
	headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

	// Add data rows
	data.forEach((row) => {
		worksheet.addRow(row);
	});

	// Auto-filter
	worksheet.autoFilter = {
		from: 'A1',
		to: `Y${data.length + 1}`
	};

	// Freeze header row
	worksheet.views = [{ state: 'frozen', ySplit: 1 }];

	// Generate buffer
	const buffer = await workbook.xlsx.writeBuffer();
	return Buffer.from(buffer);
}
