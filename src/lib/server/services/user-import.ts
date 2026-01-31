/**
 * User Import Service
 *
 * Handles importing users from Excel/CSV files.
 * Supports AICS format and provides validation, error reporting,
 * and batch database insertion.
 */

import ExcelJS from 'exceljs';
import { prisma } from '$lib/server/db/prisma';
import pino from 'pino';
import { Readable } from 'stream';
import type {
	AICSImportRow,
	FileParseResult,
	ValidationResult,
	ProcessedImportRow,
	ImportResult,
	ImportOptions,
	ImportPreview,
	ColumnMapping
} from '$lib/types/import';
import {
	AICS_COLUMN_MAPPING,
	ALTERNATIVE_COLUMN_NAMES,
	IMPORT_ERROR_MESSAGES,
	ImportErrorCode
} from '$lib/types/import';
import {
	validateImportRow,
	processImportRow,
	generateErrorSummary,
	mergeImportRows,
	normalizeEmail
} from '$lib/server/utils/import-validation';
import type { MergeInfo, MergeConflict } from '$lib/types/import';
import { subscribeToNewsletter, type SubscriptionResult } from '$lib/server/integrations/mailchimp';
import { calculateEndDate } from '$lib/server/services/membership';

const logger = pino({ name: 'user-import' });

// Maximum file size (5MB)
const MAX_FILE_SIZE = 5 * 1024 * 1024;

// Maximum rows per import
const MAX_ROWS = 5000;

/**
 * Find header row and column mapping in worksheet
 * AICS files may have 2 header rows
 */
function findHeaderRow(
	worksheet: ExcelJS.Worksheet
): { headerRow: number; columnMapping: Map<string, number> } | null {
	// Try the first 5 rows to find headers
	for (let rowNum = 1; rowNum <= 5; rowNum++) {
		const row = worksheet.getRow(rowNum);
		const values = row.values as (string | undefined)[];

		// Create a mapping from column name to column index
		const columnMapping = new Map<string, number>();

		// Check if this row contains expected headers
		for (let colNum = 1; colNum < values.length; colNum++) {
			const cellValue = values[colNum]?.toString().trim().toUpperCase();
			if (!cellValue) continue;

			// Try to match with known column names
			for (const [field, alternatives] of Object.entries(ALTERNATIVE_COLUMN_NAMES)) {
				for (const alt of alternatives) {
					if (cellValue === alt.toUpperCase()) {
						columnMapping.set(field, colNum);
						break;
					}
				}
			}
		}

		// Check if we found the essential columns
		const hasEssentialColumns =
			columnMapping.has('cognome') &&
			columnMapping.has('nome') &&
			columnMapping.has('email') &&
			columnMapping.has('dataNascita');

		if (hasEssentialColumns) {
			return { headerRow: rowNum, columnMapping };
		}
	}

	return null;
}

/**
 * Extract row data using column mapping
 */
function extractRowData(
	row: ExcelJS.Row,
	columnMapping: Map<string, number>,
	rowNumber: number
): AICSImportRow {
	const getValue = (field: keyof ColumnMapping): string => {
		const colIndex = columnMapping.get(field);
		if (!colIndex) return '';

		const cell = row.getCell(colIndex);
		let value = '';

		if (cell.value === null || cell.value === undefined) {
			return '';
		}

		// Handle different cell types
		if (cell.type === ExcelJS.ValueType.Date) {
			const date = cell.value as Date;
			// Format as DD/MM/YYYY (use UTC to avoid timezone offset)
			const day = date.getUTCDate().toString().padStart(2, '0');
			const month = (date.getUTCMonth() + 1).toString().padStart(2, '0');
			const year = date.getUTCFullYear();
			value = `${day}/${month}/${year}`;
		} else if (cell.type === ExcelJS.ValueType.RichText) {
			value = (cell.value as ExcelJS.CellRichTextValue).richText
				.map((rt) => rt.text)
				.join('');
		} else {
			value = cell.value?.toString() || '';
		}

		return value.trim();
	};

	return {
		cognome: getValue('cognome'),
		nome: getValue('nome'),
		email: getValue('email'),
		dataNascita: getValue('dataNascita'),
		sesso: getValue('sesso') as 'M' | 'F' | '',
		codiceFiscale: getValue('codiceFiscale'),
		provinciaNascita: getValue('provinciaNascita'),
		comuneNascita: getValue('comuneNascita'),
		indirizzo: getValue('indirizzo'),
		cap: getValue('cap'),
		provincia: getValue('provincia'),
		comune: getValue('comune'),
		cellulare: getValue('cellulare'),
		numeroTessera: getValue('numeroTessera'),
		dataRilascioTessera: getValue('dataRilascioTessera'),
		newsletter: getValue('newsletter'),
		_rowNumber: rowNumber
	};
}

/**
 * Parse Excel file (.xlsx)
 */
async function parseExcelFile(buffer: Buffer): Promise<FileParseResult> {
	try {
		const workbook = new ExcelJS.Workbook();
		// Use stream to read the buffer
		const stream = Readable.from(buffer);
		await workbook.xlsx.read(stream);

		// Get first worksheet
		const worksheet = workbook.worksheets[0];
		if (!worksheet) {
			return {
				success: false,
				rows: [],
				error: 'Il file non contiene fogli di lavoro',
				rowCount: 0
			};
		}

		// Find headers
		const headerResult = findHeaderRow(worksheet);
		if (!headerResult) {
			return {
				success: false,
				rows: [],
				error: IMPORT_ERROR_MESSAGES[ImportErrorCode.MISSING_HEADERS],
				rowCount: 0
			};
		}

		const { headerRow, columnMapping } = headerResult;
		const rows: AICSImportRow[] = [];

		// Extract data rows (starting after header)
		worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
			if (rowNumber <= headerRow) return;
			if (rows.length >= MAX_ROWS) return;

			const rowData = extractRowData(row, columnMapping, rowNumber);

			// Skip completely empty rows
			if (!rowData.email && !rowData.nome && !rowData.cognome) {
				return;
			}

			rows.push(rowData);
		});

		return {
			success: true,
			rows,
			rowCount: rows.length,
			headerRow
		};
	} catch (error) {
		logger.error({ error }, 'Failed to parse Excel file');
		return {
			success: false,
			rows: [],
			error: IMPORT_ERROR_MESSAGES[ImportErrorCode.PARSE_ERROR],
			rowCount: 0
		};
	}
}

/**
 * Parse CSV file
 */
async function parseCsvFile(buffer: Buffer): Promise<FileParseResult> {
	try {
		const workbook = new ExcelJS.Workbook();

		// Try different delimiters
		const content = buffer.toString('utf-8');
		const delimiter = content.includes(';') ? ';' : ',';

		await workbook.csv.read(
			// Create a readable stream from buffer
			Readable.from([buffer]),
			{
				parserOptions: {
					delimiter,
					quote: '"',
					escape: '"'
				}
			}
		);

		// Get first worksheet
		const worksheet = workbook.worksheets[0];
		if (!worksheet) {
			return {
				success: false,
				rows: [],
				error: 'Il file CSV è vuoto',
				rowCount: 0
			};
		}

		// Find headers
		const headerResult = findHeaderRow(worksheet);
		if (!headerResult) {
			return {
				success: false,
				rows: [],
				error: IMPORT_ERROR_MESSAGES[ImportErrorCode.MISSING_HEADERS],
				rowCount: 0
			};
		}

		const { headerRow, columnMapping } = headerResult;
		const rows: AICSImportRow[] = [];

		// Extract data rows (starting after header)
		worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
			if (rowNumber <= headerRow) return;
			if (rows.length >= MAX_ROWS) return;

			const rowData = extractRowData(row, columnMapping, rowNumber);

			// Skip completely empty rows
			if (!rowData.email && !rowData.nome && !rowData.cognome) {
				return;
			}

			rows.push(rowData);
		});

		return {
			success: true,
			rows,
			rowCount: rows.length,
			headerRow
		};
	} catch (error) {
		logger.error({ error }, 'Failed to parse CSV file');
		return {
			success: false,
			rows: [],
			error: IMPORT_ERROR_MESSAGES[ImportErrorCode.PARSE_ERROR],
			rowCount: 0
		};
	}
}

/**
 * Parse import file (Excel or CSV)
 */
export async function parseImportFile(
	file: File
): Promise<FileParseResult> {
	// Check file size
	if (file.size > MAX_FILE_SIZE) {
		return {
			success: false,
			rows: [],
			error: IMPORT_ERROR_MESSAGES[ImportErrorCode.FILE_TOO_LARGE],
			rowCount: 0
		};
	}

	// Get file extension
	const fileName = file.name.toLowerCase();
	const isExcel = fileName.endsWith('.xlsx') || fileName.endsWith('.xls');
	const isCsv = fileName.endsWith('.csv');

	if (!isExcel && !isCsv) {
		return {
			success: false,
			rows: [],
			error: IMPORT_ERROR_MESSAGES[ImportErrorCode.INVALID_FILE_TYPE],
			rowCount: 0
		};
	}

	// Convert File to Buffer
	const arrayBuffer = await file.arrayBuffer();
	const buffer = Buffer.from(arrayBuffer);

	// Parse based on file type
	if (isExcel) {
		return parseExcelFile(buffer);
	} else {
		return parseCsvFile(buffer);
	}
}

/**
 * Parse import file from Buffer (for server-side processing)
 */
export async function parseImportFileFromBuffer(
	buffer: Buffer,
	fileName: string
): Promise<FileParseResult> {
	// Check file size
	if (buffer.length > MAX_FILE_SIZE) {
		return {
			success: false,
			rows: [],
			error: IMPORT_ERROR_MESSAGES[ImportErrorCode.FILE_TOO_LARGE],
			rowCount: 0
		};
	}

	// Get file extension
	const fileNameLower = fileName.toLowerCase();
	const isExcel = fileNameLower.endsWith('.xlsx') || fileNameLower.endsWith('.xls');
	const isCsv = fileNameLower.endsWith('.csv');

	if (!isExcel && !isCsv) {
		return {
			success: false,
			rows: [],
			error: IMPORT_ERROR_MESSAGES[ImportErrorCode.INVALID_FILE_TYPE],
			rowCount: 0
		};
	}

	// Parse based on file type
	if (isExcel) {
		return parseExcelFile(buffer);
	} else {
		return parseCsvFile(buffer);
	}
}

/**
 * Options for validation
 */
export interface ValidateOptions {
	addMembershipToExisting: boolean;
}

/**
 * Internal structure for tracking rows to be merged
 */
interface MergeableRow {
	row: AICSImportRow;
	rowNumber: number;
	mergedRowNumbers: number[];
	conflicts: MergeConflict[];
}

/**
 * Result of validation including original rows mapping
 */
export interface ValidationResultWithMapping {
	results: ValidationResult[];
	mergedRows: AICSImportRow[];
	/** Maps merged row index to original row indices */
	rowMapping: Map<number, number[]>;
}

/**
 * Validate import rows, merging duplicates with the same email
 */
export async function validateImportRows(
	rows: AICSImportRow[],
	options: ValidateOptions = { addMembershipToExisting: false }
): Promise<ValidationResult[]> {
	const { results } = await validateImportRowsWithMapping(rows, options);
	return results;
}

/**
 * Validate import rows with full mapping information
 * Merges duplicate emails before validation
 */
export async function validateImportRowsWithMapping(
	rows: AICSImportRow[],
	options: ValidateOptions = { addMembershipToExisting: false }
): Promise<ValidationResultWithMapping> {
	// Get all existing users from database with their membership status
	const existingUsersData = await prisma.user.findMany({
		select: {
			id: true,
			email: true,
			memberships: {
				where: {
					status: 'ACTIVE'
				},
				select: {
					id: true
				},
				take: 1
			}
		}
	});

	// Build map of email -> user info
	const existingUsers = new Map<string, { id: string; hasActiveMembership: boolean }>();
	for (const user of existingUsersData) {
		existingUsers.set(user.email.toLowerCase(), {
			id: user.id,
			hasActiveMembership: user.memberships.length > 0
		});
	}

	// === STEP 1: Group rows by email and merge duplicates ===
	const mergeableRows = new Map<string, MergeableRow>();

	for (let i = 0; i < rows.length; i++) {
		const row = rows[i];
		const rowNumber = row._rowNumber || i + 2; // +2 to account for 1-indexed and header row
		const email = normalizeEmail(row.email || '');

		// Skip rows without email - they'll fail validation anyway
		if (!email) {
			// Add as-is without merging
			const uniqueKey = `__no_email_${i}`;
			mergeableRows.set(uniqueKey, {
				row,
				rowNumber,
				mergedRowNumbers: [rowNumber],
				conflicts: []
			});
			continue;
		}

		const existing = mergeableRows.get(email);
		if (existing) {
			// Merge with existing row
			const { merged, conflicts } = mergeImportRows(
				existing.row,
				existing.rowNumber,
				row,
				rowNumber
			);
			existing.row = merged;
			existing.mergedRowNumbers.push(rowNumber);
			existing.conflicts.push(...conflicts);
		} else {
			// First occurrence of this email
			mergeableRows.set(email, {
				row,
				rowNumber,
				mergedRowNumbers: [rowNumber],
				conflicts: []
			});
		}
	}

	// === STEP 2: Validate merged rows ===
	const results: ValidationResult[] = [];
	const mergedRows: AICSImportRow[] = [];
	const rowMapping = new Map<number, number[]>();

	let mergedIndex = 0;
	for (const [, mergeable] of mergeableRows) {
		const { row, rowNumber, mergedRowNumbers, conflicts } = mergeable;

		// Build merge info if multiple rows were merged
		let mergeInfo: MergeInfo | undefined;
		if (mergedRowNumbers.length > 1) {
			mergeInfo = {
				mergedRows: mergedRowNumbers,
				conflicts
			};
		}

		// Validate the (potentially merged) row
		const result = await validateImportRow(row, rowNumber, existingUsers, mergeInfo, {
			addMembershipToExisting: options.addMembershipToExisting
		});

		results.push(result);
		mergedRows.push(row);
		rowMapping.set(mergedIndex, mergedRowNumbers);
		mergedIndex++;
	}

	return { results, mergedRows, rowMapping };
}

/**
 * Generate import preview
 */
export async function generateImportPreview(
	rows: AICSImportRow[],
	options: ValidateOptions = { addMembershipToExisting: false }
): Promise<ImportPreview> {
	const { results: validationResults, mergedRows } = await validateImportRowsWithMapping(rows, options);

	let validCount = 0;
	let warningCount = 0;
	let errorCount = 0;
	let duplicateCount = 0;
	const mergedGroups: ImportPreview['mergedGroups'] = [];

	const previewRows = mergedRows.map((row, index) => {
		const validation = validationResults[index];
		const processed = processImportRow(row, validation);

		switch (validation.status) {
			case 'valid':
				validCount++;
				break;
			case 'warning':
				warningCount++;
				break;
			case 'error':
				errorCount++;
				break;
		}

		// Count rows that were merged (had duplicate emails)
		if (validation.mergeInfo && validation.mergeInfo.mergedRows.length > 1) {
			duplicateCount++;
			mergedGroups.push({
				email: row.email || '',
				rows: validation.mergeInfo.mergedRows,
				conflicts: validation.mergeInfo.conflicts
			});
		}

		return {
			rowNumber: row._rowNumber || index + 2,
			original: row,
			processed,
			validation
		};
	});

	return {
		totalRows: rows.length,
		uniqueRowCount: mergedRows.length,
		validCount,
		warningCount,
		errorCount,
		duplicateCount,
		mergedGroups,
		rows: previewRows
	};
}

/**
 * Import users into database
 */
export async function importUsers(
	rows: AICSImportRow[],
	validationResults: ValidationResult[],
	options: ImportOptions,
	adminId: string
): Promise<ImportResult> {
	const results: ImportResult['results'] = [];
	const errors: ImportResult['errors'] = [];
	const warnings: ImportResult['warnings'] = [];

	let importedCount = 0;
	let skippedCount = 0;
	let errorCount = 0;

	// Newsletter subscription tracking
	const newsletterStats: ImportResult['newsletter'] = {
		requested: 0,
		subscribed: 0,
		alreadySubscribed: 0,
		failed: 0,
		errors: []
	};

	// Get membership fee - always needed since we always create memberships
	let membershipFee: number = 2500; // Default to 2500 cents (€25)
	try {
		const { getMembershipFee } = await import('./settings');
		membershipFee = await getMembershipFee();
	} catch {
		// Use default if settings not available
		logger.warn('Could not fetch membership fee, using default €25');
	}

	// Process each row
	for (let i = 0; i < rows.length; i++) {
		const row = rows[i];
		const validation = validationResults[i];
		const rowNumber = row._rowNumber || i + 2;

		// Skip rows with errors
		if (validation.status === 'error') {
			skippedCount++;
			errorCount++;
			errors.push({
				rowNumber,
				email: row.email || '',
				errors: validation.errors
			});
			results.push({
				rowNumber,
				success: false,
				email: row.email || '',
				firstName: row.nome || '',
				lastName: row.cognome || '',
				error: validation.errors.join('; '),
				originalData: row
			});
			continue;
		}

		// Process the row
		const processed = processImportRow(row, validation);
		if (!processed) {
			skippedCount++;
			errorCount++;
			errors.push({
				rowNumber,
				email: row.email || '',
				errors: ['Errore nel processare i dati']
			});
			results.push({
				rowNumber,
				success: false,
				email: row.email || '',
				firstName: row.nome || '',
				lastName: row.cognome || '',
				error: 'Errore nel processare i dati',
				originalData: row
			});
			continue;
		}

		// Record warnings
		if (validation.warnings.length > 0) {
			warnings.push({
				rowNumber,
				email: processed.email,
				warnings: validation.warnings
			});
		}

		// Handle existing user with membership addition
		if (validation.isExistingUser && validation.existingUserId && options.addMembershipToExisting) {
			// Check if user already has active membership (in which case we skip)
			const existingUser = await prisma.user.findUnique({
				where: { id: validation.existingUserId },
				select: {
					id: true,
					memberships: {
						where: { status: 'ACTIVE' },
						select: { id: true },
						take: 1
					}
				}
			});

			if (existingUser?.memberships && existingUser.memberships.length > 0) {
				// User already has active membership - update startDate/endDate
				const activeMembership = existingUser.memberships[0];
				const startDate = processed.membershipStartDate || null;
				const endDate = startDate ? calculateEndDate(startDate) : null;

				try {
					await prisma.membership.update({
						where: { id: activeMembership.id },
						data: {
							startDate,
							endDate,
							updatedBy: adminId
						}
					});

					importedCount++;
					results.push({
						rowNumber,
						success: true,
						userId: validation.existingUserId,
						membershipId: activeMembership.id,
						email: processed.email,
						firstName: processed.firstName,
						lastName: processed.lastName,
						originalData: row,
						processedData: processed
					});
				} catch (error) {
					logger.error({ error, rowNumber, email: processed.email }, 'Failed to update membership dates for existing user');
					skippedCount++;
					errorCount++;
					errors.push({
						rowNumber,
						email: processed.email,
						errors: ['Errore durante l\'aggiornamento delle date']
					});
					results.push({
						rowNumber,
						success: false,
						userId: validation.existingUserId,
						email: processed.email,
						firstName: processed.firstName,
						lastName: processed.lastName,
						error: 'Errore durante l\'aggiornamento delle date',
						originalData: row,
						processedData: processed
					});
				}
				continue;
			}

			// Add membership to existing user
			try {
				const now = new Date();
				const startDate = processed.membershipStartDate || null;
				const endDate = startDate ? calculateEndDate(startDate) : null;

				// PENDING (S4_AWAITING_NUMBER) if no card number, ACTIVE (S5) if card assigned
				const hasCardNumber = !!processed.membershipNumber;
				const membership = await prisma.membership.create({
					data: {
						userId: validation.existingUserId,
						membershipNumber: processed.membershipNumber,
						status: hasCardNumber ? 'ACTIVE' : 'PENDING',
						paymentStatus: 'SUCCEEDED',
						startDate,
						endDate,
						cardAssignedAt: hasCardNumber ? now : null,
						paymentAmount: membershipFee!,
						updatedBy: adminId
					}
				});

				importedCount++;

				// Handle newsletter subscription for existing user
				let newsletterSubscribed = false;
				let newsletterError: string | undefined;

				if (processed.subscribeToNewsletter) {
					newsletterStats.requested++;
					try {
						const subscriptionResult = await subscribeToNewsletter(processed.email, {
							firstName: processed.firstName,
							lastName: processed.lastName,
							birthDate: processed.birthDate,
							birthCity: processed.birthCity,
							taxCode: processed.taxCode || undefined,
							address: processed.address || undefined,
							city: processed.city || undefined,
							postalCode: processed.postalCode || undefined,
							province: processed.province || undefined
						});

						if (subscriptionResult.status === 'subscribed') {
							newsletterStats.subscribed++;
							newsletterSubscribed = true;
						} else if (subscriptionResult.status === 'resubscribed') {
							newsletterStats.alreadySubscribed++;
							newsletterSubscribed = true;
						} else {
							newsletterStats.failed++;
							newsletterError = 'Subscription failed';
							newsletterStats.errors.push({
								email: processed.email,
								error: 'Subscription failed'
							});
						}
					} catch (err) {
						newsletterStats.failed++;
						newsletterError = err instanceof Error ? err.message : 'Unknown error';
						newsletterStats.errors.push({
							email: processed.email,
							error: newsletterError
						});
						logger.error({ error: err, email: processed.email }, 'Failed to subscribe existing user to newsletter');
					}
				}

				results.push({
					rowNumber,
					success: true,
					userId: validation.existingUserId,
					membershipId: membership.id,
					email: processed.email,
					firstName: processed.firstName,
					lastName: processed.lastName,
					newsletterSubscribed,
					newsletterError,
					originalData: row,
					processedData: processed
				});
			} catch (error) {
				logger.error({ error, rowNumber, email: processed.email }, 'Failed to add membership to existing user');
				skippedCount++;
				errorCount++;
				errors.push({
					rowNumber,
					email: processed.email,
					errors: ['Errore durante l\'aggiunta della membership']
				});
				results.push({
					rowNumber,
					success: false,
					userId: validation.existingUserId,
					email: processed.email,
					firstName: processed.firstName,
					lastName: processed.lastName,
					error: 'Errore durante l\'aggiunta della membership',
					originalData: row,
					processedData: processed
				});
			}
			continue;
		}

		// Create new user in database
		try {
			const result = await prisma.$transaction(async (tx) => {
				// Create user
				const user = await tx.user.create({
					data: {
						email: processed.email,
						phone: processed.phone,
						profile: {
							create: {
								firstName: processed.firstName,
								lastName: processed.lastName,
								birthDate: processed.birthDate,
								taxCode: processed.taxCode,
								nationality: processed.nationality,
								birthProvince: processed.birthProvince,
								birthCity: processed.birthCity,
								hasForeignTaxCode: processed.hasForeignTaxCode,
								gender: processed.gender,
								address: processed.address,
								city: processed.city,
								postalCode: processed.postalCode,
								province: processed.province,
								residenceCountry: processed.residenceCountry,
								privacyConsent: true,
								dataConsent: true,
								profileComplete: true
							}
						}
					}
				});

				// Always create membership for imported users
				// - With card number: ACTIVE (S5)
				// - Without card number: PENDING (S4_AWAITING_NUMBER)
				const now = new Date();
				const startDate = processed.membershipStartDate || null;
				const endDate = startDate ? calculateEndDate(startDate) : null;

				const hasCardNumber = !!processed.membershipNumber;
				const membership = await tx.membership.create({
					data: {
						userId: user.id,
						membershipNumber: processed.membershipNumber,
						status: hasCardNumber ? 'ACTIVE' : 'PENDING',
						paymentStatus: 'SUCCEEDED',
						startDate,
						endDate,
						cardAssignedAt: hasCardNumber ? now : null,
						paymentAmount: membershipFee,
						updatedBy: adminId
					}
				});

				const membershipId = membership.id;

				return { userId: user.id, membershipId };
			});

			importedCount++;

			// Handle newsletter subscription
			let newsletterSubscribed = false;
			let newsletterError: string | undefined;

			if (processed.subscribeToNewsletter) {
				newsletterStats.requested++;
				try {
					const subscriptionResult = await subscribeToNewsletter(processed.email, {
						firstName: processed.firstName,
						lastName: processed.lastName,
						birthDate: processed.birthDate,
						birthCity: processed.birthCity,
						taxCode: processed.taxCode || undefined,
						address: processed.address || undefined,
						city: processed.city || undefined,
						postalCode: processed.postalCode || undefined,
						province: processed.province || undefined
					});

					if (subscriptionResult.status === 'subscribed') {
						newsletterStats.subscribed++;
						newsletterSubscribed = true;
					} else if (subscriptionResult.status === 'resubscribed') {
						newsletterStats.alreadySubscribed++;
						newsletterSubscribed = true;
					} else {
						newsletterStats.failed++;
						newsletterError = 'Subscription failed';
						newsletterStats.errors.push({
							email: processed.email,
							error: 'Subscription failed'
						});
					}
				} catch (err) {
					newsletterStats.failed++;
					newsletterError = err instanceof Error ? err.message : 'Unknown error';
					newsletterStats.errors.push({
						email: processed.email,
						error: newsletterError
					});
					logger.error({ error: err, email: processed.email }, 'Failed to subscribe user to newsletter');
				}
			}

			results.push({
				rowNumber,
				success: true,
				userId: result.userId,
				membershipId: result.membershipId,
				email: processed.email,
				firstName: processed.firstName,
				lastName: processed.lastName,
				newsletterSubscribed,
				newsletterError,
				originalData: row,
				processedData: processed
			});
		} catch (error) {
			logger.error({ error, rowNumber, email: processed.email }, 'Failed to import user');

			skippedCount++;
			errorCount++;

			const errorMessage =
				error instanceof Error && error.message.includes('Unique constraint')
					? 'Email già registrata'
					: 'Errore durante il salvataggio';

			errors.push({
				rowNumber,
				email: processed.email,
				errors: [errorMessage]
			});
			results.push({
				rowNumber,
				success: false,
				email: processed.email,
				firstName: processed.firstName,
				lastName: processed.lastName,
				error: errorMessage,
				originalData: row,
				processedData: processed
			});
		}
	}

	return {
		success: errorCount === 0,
		totalRows: rows.length,
		importedCount,
		skippedCount,
		errorCount,
		results,
		errors,
		warnings,
		newsletter: newsletterStats
	};
}

/**
 * Generate error report as Excel file
 */
export async function generateErrorReport(
	results: ValidationResult[],
	originalRows: AICSImportRow[]
): Promise<Buffer> {
	const workbook = new ExcelJS.Workbook();
	const worksheet = workbook.addWorksheet('Errori Import');

	// Add headers
	worksheet.columns = [
		{ header: 'Riga', key: 'row', width: 8 },
		{ header: 'Cognome', key: 'cognome', width: 20 },
		{ header: 'Nome', key: 'nome', width: 20 },
		{ header: 'Email', key: 'email', width: 30 },
		{ header: 'Stato', key: 'status', width: 12 },
		{ header: 'Errori', key: 'errors', width: 50 },
		{ header: 'Avvisi', key: 'warnings', width: 50 }
	];

	// Style header row
	const headerRow = worksheet.getRow(1);
	headerRow.font = { bold: true };
	headerRow.fill = {
		type: 'pattern',
		pattern: 'solid',
		fgColor: { argb: 'FFE0E0E0' }
	};

	// Add data rows
	for (let i = 0; i < results.length; i++) {
		const result = results[i];
		const row = originalRows[i];

		// Only include rows with errors or warnings
		if (result.status === 'valid') continue;

		worksheet.addRow({
			row: result.originalRow,
			cognome: row.cognome,
			nome: row.nome,
			email: row.email,
			status: result.status === 'error' ? 'Errore' : 'Avviso',
			errors: result.errors.join('\n'),
			warnings: result.warnings.join('\n')
		});
	}

	// Apply conditional formatting for error/warning rows
	worksheet.eachRow((row, rowNumber) => {
		if (rowNumber === 1) return;

		const statusCell = row.getCell('status');
		if (statusCell.value === 'Errore') {
			row.fill = {
				type: 'pattern',
				pattern: 'solid',
				fgColor: { argb: 'FFFFCCCC' }
			};
		} else if (statusCell.value === 'Avviso') {
			row.fill = {
				type: 'pattern',
				pattern: 'solid',
				fgColor: { argb: 'FFFFFFCC' }
			};
		}
	});

	// Generate buffer
	return Buffer.from(await workbook.xlsx.writeBuffer());
}

/**
 * Generate success report as Excel file with separate tabs
 */
export async function generateSuccessReport(
	importResult: ImportResult
): Promise<Buffer> {
	const workbook = new ExcelJS.Workbook();

	// Common column definitions for all data sheets
	const dataColumns = [
		{ header: 'Riga', key: 'row', width: 6 },
		{ header: 'Cognome', key: 'cognome', width: 18 },
		{ header: 'Nome', key: 'nome', width: 18 },
		{ header: 'Email', key: 'email', width: 28 },
		{ header: 'Data Nascita', key: 'dataNascita', width: 12 },
		{ header: 'Sesso', key: 'sesso', width: 6 },
		{ header: 'Codice Fiscale', key: 'codiceFiscale', width: 18 },
		{ header: 'Prov. Nascita', key: 'provinciaNascita', width: 10 },
		{ header: 'Comune Nascita', key: 'comuneNascita', width: 18 },
		{ header: 'Indirizzo', key: 'indirizzo', width: 25 },
		{ header: 'CAP', key: 'cap', width: 8 },
		{ header: 'Provincia', key: 'provincia', width: 10 },
		{ header: 'Comune', key: 'comune', width: 18 },
		{ header: 'Cellulare', key: 'cellulare', width: 15 },
		{ header: 'N° Tessera', key: 'numeroTessera', width: 12 },
		{ header: 'Data Rilascio', key: 'dataRilascio', width: 12 },
		{ header: 'Newsletter', key: 'newsletter', width: 12 },
		{ header: 'User ID', key: 'userId', width: 26 },
		{ header: 'Note', key: 'note', width: 40 }
	];

	// Helper to style header row
	const styleHeaderRow = (sheet: ExcelJS.Worksheet, color: string) => {
		const header = sheet.getRow(1);
		header.font = { bold: true };
		header.fill = {
			type: 'pattern',
			pattern: 'solid',
			fgColor: { argb: color }
		};
	};

	// Helper to format date
	const formatDate = (date: Date | string | null | undefined): string => {
		if (!date) return '';
		if (typeof date === 'string') return date;
		const d = date.getDate().toString().padStart(2, '0');
		const m = (date.getMonth() + 1).toString().padStart(2, '0');
		const y = date.getFullYear();
		return `${d}/${m}/${y}`;
	};

	// Helper to format merge info for notes
	const formatMergeInfo = (result: typeof importResult.results[0]): string => {
		const mergeInfo = result.processedData?.validationResult?.mergeInfo;
		if (!mergeInfo || mergeInfo.mergedRows.length <= 1) {
			return '';
		}

		const parts: string[] = [];
		parts.push(`Unione righe ${mergeInfo.mergedRows.join(', ')}`);

		if (mergeInfo.conflicts.length > 0) {
			const conflictParts = mergeInfo.conflicts.map(c =>
				`${c.field}: usato '${c.usedValue}' (riga ${c.usedFromRow}), ignorato '${c.discardedValue}' (riga ${c.discardedFromRow})`
			);
			parts.push(`Conflitti: ${conflictParts.join('; ')}`);
		}

		return parts.join(' | ');
	};

	// Helper to get row data (prefers processed data, falls back to original)
	const getRowData = (result: typeof importResult.results[0]) => {
		const processed = result.processedData;
		const original = result.originalData;

		if (processed) {
			return {
				row: result.rowNumber,
				cognome: processed.lastName,
				nome: processed.firstName,
				email: processed.email,
				dataNascita: formatDate(processed.birthDate),
				sesso: processed.gender || '',
				codiceFiscale: processed.taxCode || '',
				provinciaNascita: processed.birthProvince || '',
				comuneNascita: processed.birthCity || '',
				indirizzo: processed.address || '',
				cap: processed.postalCode || '',
				provincia: processed.province || '',
				comune: processed.city || '',
				cellulare: processed.phone || '',
				numeroTessera: processed.membershipNumber || '',
				dataRilascio: formatDate(processed.membershipStartDate),
				newsletter: processed.subscribeToNewsletter ? 'Sì' : 'No'
			};
		} else if (original) {
			return {
				row: result.rowNumber,
				cognome: original.cognome,
				nome: original.nome,
				email: original.email,
				dataNascita: original.dataNascita,
				sesso: original.sesso || '',
				codiceFiscale: original.codiceFiscale || '',
				provinciaNascita: original.provinciaNascita || '',
				comuneNascita: original.comuneNascita || '',
				indirizzo: original.indirizzo || '',
				cap: original.cap || '',
				provincia: original.provincia || '',
				comune: original.comune || '',
				cellulare: original.cellulare || '',
				numeroTessera: original.numeroTessera || '',
				dataRilascio: original.dataRilascioTessera || '',
				newsletter: original.newsletter || ''
			};
		} else {
			return {
				row: result.rowNumber,
				cognome: result.lastName,
				nome: result.firstName,
				email: result.email,
				dataNascita: '',
				sesso: '',
				codiceFiscale: '',
				provinciaNascita: '',
				comuneNascita: '',
				indirizzo: '',
				cap: '',
				provincia: '',
				comune: '',
				cellulare: '',
				numeroTessera: '',
				dataRilascio: '',
				newsletter: ''
			};
		}
	};

	// Separate results by type
	// - Importati: successful imports
	// - Non Importati: intentionally skipped (e.g., user already has active membership)
	// - Errori: validation errors, database errors, etc.
	const SKIP_MESSAGES = [
		'Utente già presente con membership attiva'
	];

	const importedResults = importResult.results.filter(r => r.success);
	const skippedResults = importResult.results.filter(r =>
		!r.success && r.error && SKIP_MESSAGES.some(msg => r.error?.includes(msg))
	);
	const errorResults = importResult.results.filter(r =>
		!r.success && r.error && !SKIP_MESSAGES.some(msg => r.error?.includes(msg))
	);

	// === TAB 1: Importati ===
	const importedSheet = workbook.addWorksheet('Importati');
	importedSheet.columns = dataColumns;
	styleHeaderRow(importedSheet, 'FF90EE90'); // Light green

	for (const result of importedResults) {
		const data = getRowData(result);
		const notes: string[] = [];

		// Add merge info if present
		const mergeNote = formatMergeInfo(result);
		if (mergeNote) {
			notes.push(mergeNote);
		}

		// Add newsletter info
		if (result.newsletterSubscribed) {
			notes.push('Iscritto a newsletter');
		} else if (result.newsletterError) {
			notes.push(`Newsletter: ${result.newsletterError}`);
		}

		importedSheet.addRow({
			...data,
			userId: result.userId || '',
			note: notes.join(' | ')
		});
	}

	// === TAB 2: Non Importati (skipped without critical errors) ===
	const skippedSheet = workbook.addWorksheet('Non Importati');
	skippedSheet.columns = dataColumns;
	styleHeaderRow(skippedSheet, 'FFFFD700'); // Gold/yellow

	for (const result of skippedResults) {
		const data = getRowData(result);
		const notes: string[] = [];

		// Add merge info if present
		const mergeNote = formatMergeInfo(result);
		if (mergeNote) {
			notes.push(mergeNote);
		}

		// Add error/skip reason
		if (result.error) {
			notes.push(result.error);
		}

		skippedSheet.addRow({
			...data,
			userId: result.userId || '',
			note: notes.join(' | ')
		});
	}

	// === TAB 3: Errori ===
	const errorSheet = workbook.addWorksheet('Errori');
	errorSheet.columns = dataColumns;
	styleHeaderRow(errorSheet, 'FFFF6B6B'); // Light red

	for (const result of errorResults) {
		const data = getRowData(result);
		const notes: string[] = [];

		// Add merge info if present
		const mergeNote = formatMergeInfo(result);
		if (mergeNote) {
			notes.push(mergeNote);
		}

		// Add error
		if (result.error) {
			notes.push(result.error);
		}

		errorSheet.addRow({
			...data,
			userId: result.userId || '',
			note: notes.join(' | ')
		});
	}

	// === TAB 4: Riepilogo ===
	const summarySheet = workbook.addWorksheet('Riepilogo');
	summarySheet.columns = [
		{ header: 'Metrica', key: 'metric', width: 30 },
		{ header: 'Valore', key: 'value', width: 15 }
	];
	styleHeaderRow(summarySheet, 'FFE0E0E0');

	summarySheet.addRow({ metric: 'Totale righe nel file', value: importResult.totalRows });
	summarySheet.addRow({ metric: 'Importati con successo', value: importResult.importedCount });
	summarySheet.addRow({ metric: 'Non importati', value: importResult.skippedCount });
	summarySheet.addRow({ metric: 'Con errori', value: importResult.errorCount });

	// Newsletter section
	summarySheet.addRow({ metric: '', value: '' });
	summarySheet.addRow({ metric: '=== Newsletter (Mailchimp) ===', value: '' });
	summarySheet.addRow({ metric: 'Richieste di iscrizione', value: importResult.newsletter.requested });
	summarySheet.addRow({ metric: 'Iscritti con successo', value: importResult.newsletter.subscribed });
	summarySheet.addRow({ metric: 'Già iscritti in precedenza', value: importResult.newsletter.alreadySubscribed });
	summarySheet.addRow({ metric: 'Errori di iscrizione', value: importResult.newsletter.failed });

	// Add newsletter errors if any
	if (importResult.newsletter.errors.length > 0) {
		summarySheet.addRow({ metric: '', value: '' });
		summarySheet.addRow({ metric: 'Dettaglio errori newsletter:', value: '' });
		for (const err of importResult.newsletter.errors) {
			summarySheet.addRow({ metric: `  ${err.email}`, value: err.error });
		}
	}

	// Generate buffer
	return Buffer.from(await workbook.xlsx.writeBuffer());
}
