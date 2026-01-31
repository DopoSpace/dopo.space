/**
 * Admin Import Page Server
 *
 * Handles file upload, validation preview, and user import.
 */

import { fail, redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { prisma } from '$lib/server/db/prisma';
import pino from 'pino';
import {
	parseImportFileFromBuffer,
	validateImportRowsWithMapping,
	generateImportPreview,
	importUsers,
	generateErrorReport,
	generateSuccessReport
} from '$lib/server/services/user-import';
import type { AICSImportRow, ImportOptions, ImportPreview } from '$lib/types/import';

const logger = pino({ name: 'admin-import' });

// Store previews in memory (in production, use Redis or similar)
const previewCache = new Map<string, {
	preview: ImportPreview;
	rows: AICSImportRow[];  // Original rows from file
	mergedRows: AICSImportRow[];  // Rows after merging duplicates
	timestamp: number;
}>();

// Clean up old previews (older than 30 minutes)
function cleanupOldPreviews() {
	const thirtyMinutesAgo = Date.now() - 30 * 60 * 1000;
	for (const [key, value] of previewCache.entries()) {
		if (value.timestamp < thirtyMinutesAgo) {
			previewCache.delete(key);
		}
	}
}

export const load: PageServerLoad = async ({ locals }) => {
	const admin = locals.admin;

	if (!admin) {
		throw redirect(303, '/login');
	}

	// Get membership fee from settings
	let membershipFee = 2500; // Default to €25.00
	try {
		const { getMembershipFee } = await import('$lib/server/services/settings');
		membershipFee = await getMembershipFee();
	} catch {
		logger.warn('Could not fetch membership fee from settings, using default');
	}

	return {
		admin: {
			id: admin.id,
			email: admin.email,
			name: admin.name
		},
		membershipFee
	};
};

export const actions: Actions = {
	/**
	 * Upload and validate file
	 */
	upload: async ({ request, locals }) => {
		const admin = locals.admin;
		if (!admin) {
			return fail(401, { error: 'Non autorizzato' });
		}

		cleanupOldPreviews();

		try {
			const formData = await request.formData();
			const file = formData.get('file') as File | null;
			const addMembershipToExisting = formData.get('addMembershipToExisting') === 'true';

			if (!file || file.size === 0) {
				return fail(400, { error: 'Nessun file caricato' });
			}

			logger.info({ fileName: file.name, fileSize: file.size, addMembershipToExisting }, 'Processing import file');

			// Convert to buffer
			const arrayBuffer = await file.arrayBuffer();
			const buffer = Buffer.from(arrayBuffer);

			// Parse file
			const parseResult = await parseImportFileFromBuffer(buffer, file.name);

			if (!parseResult.success) {
				return fail(400, { error: parseResult.error });
			}

			if (parseResult.rows.length === 0) {
				return fail(400, { error: 'Il file non contiene dati da importare' });
			}

			// Generate preview with options
			const preview = await generateImportPreview(parseResult.rows, { addMembershipToExisting });

			// Extract merged rows from preview (these are the rows after duplicate merging)
			const mergedRows = preview.rows.map(r => r.original);

			// Store in cache with unique ID
			const previewId = crypto.randomUUID();
			previewCache.set(previewId, {
				preview,
				rows: parseResult.rows,
				mergedRows,
				timestamp: Date.now()
			});

			logger.info({
				previewId,
				totalRows: preview.totalRows,
				validCount: preview.validCount,
				errorCount: preview.errorCount,
				duplicateCount: preview.duplicateCount
			}, 'Import preview generated');

			return {
				success: true,
				previewId,
				addMembershipToExisting,
				preview: {
					totalRows: preview.totalRows,
					uniqueRowCount: preview.uniqueRowCount,
					validCount: preview.validCount,
					warningCount: preview.warningCount,
					errorCount: preview.errorCount,
					duplicateCount: preview.duplicateCount,
					mergedGroups: preview.mergedGroups,
					rows: preview.rows.map(r => ({
						rowNumber: r.rowNumber,
						original: {
							cognome: r.original.cognome,
							nome: r.original.nome,
							email: r.original.email,
							dataNascita: r.original.dataNascita,
							codiceFiscale: r.original.codiceFiscale,
							provinciaNascita: r.original.provinciaNascita,
							numeroTessera: r.original.numeroTessera
						},
						status: r.validation.status,
						errors: r.validation.errors,
						warnings: r.validation.warnings,
						isExistingUser: r.validation.isExistingUser,
						mergeInfo: r.validation.mergeInfo
					}))
				}
			};
		} catch (error) {
			logger.error({ error }, 'Error processing upload');
			return fail(500, { error: 'Errore durante l\'elaborazione del file' });
		}
	},

	/**
	 * Execute import
	 */
	import: async ({ request, locals }) => {
		const admin = locals.admin;
		if (!admin) {
			return fail(401, { error: 'Non autorizzato' });
		}

		try {
			const formData = await request.formData();
			const previewId = formData.get('previewId') as string;
			const createMembership = formData.get('createMembership') === 'true';
			const addMembershipToExisting = formData.get('addMembershipToExisting') === 'true';

			// Get cached preview
			const cached = previewCache.get(previewId);
			if (!cached) {
				return fail(400, { error: 'Sessione scaduta. Ricarica il file.' });
			}

			const { mergedRows, preview } = cached;

			const options: ImportOptions = {
				createMembership,
				addMembershipToExisting
			};

			// Get validation results with options - use merged rows
			const { results: validationResults } = await validateImportRowsWithMapping(mergedRows, { addMembershipToExisting });

			// Execute import with merged rows (aligned with validation results)
			logger.info({
				previewId,
				originalRows: cached.rows.length,
				mergedRows: mergedRows.length,
				createMembership,
				addMembershipToExisting,
				adminId: admin.id
			}, 'Starting import');

			const result = await importUsers(mergedRows, validationResults, options, admin.id);

			// Clean up preview from cache
			previewCache.delete(previewId);

			// Store result for download
			const resultId = crypto.randomUUID();
			previewCache.set(`result-${resultId}`, {
				preview,
				rows: cached.rows,
				mergedRows,
				timestamp: Date.now(),
				// @ts-expect-error - Adding custom field
				importResult: result
			});

			logger.info({
				resultId,
				importedCount: result.importedCount,
				errorCount: result.errorCount
			}, 'Import completed');

			return {
				success: true,
				resultId,
				result: {
					totalRows: result.totalRows,
					importedCount: result.importedCount,
					skippedCount: result.skippedCount,
					errorCount: result.errorCount,
					errors: result.errors.slice(0, 50), // Limit errors sent to client
					warnings: result.warnings.slice(0, 50)
				}
			};
		} catch (error) {
			logger.error({ error }, 'Error executing import');
			return fail(500, { error: 'Errore durante l\'importazione' });
		}
	},

	/**
	 * Download error report
	 */
	downloadErrors: async ({ request, locals }) => {
		const admin = locals.admin;
		if (!admin) {
			return fail(401, { error: 'Non autorizzato' });
		}

		try {
			const formData = await request.formData();
			const previewId = formData.get('previewId') as string;

			// Get cached data
			const cached = previewCache.get(previewId);
			if (!cached) {
				return fail(400, { error: 'Sessione scaduta' });
			}

			const { mergedRows, preview } = cached;

			// Generate report using merged rows (aligned with validation results)
			const validationResults = preview.rows.map(r => r.validation);
			const buffer = await generateErrorReport(validationResults, mergedRows);

			return {
				success: true,
				report: buffer.toString('base64'),
				filename: `errori-import-${new Date().toISOString().split('T')[0]}.xlsx`
			};
		} catch (error) {
			logger.error({ error }, 'Error generating error report');
			return fail(500, { error: 'Errore durante la generazione del report' });
		}
	},

	/**
	 * Download success report
	 */
	downloadReport: async ({ request, locals }) => {
		const admin = locals.admin;
		if (!admin) {
			return fail(401, { error: 'Non autorizzato' });
		}

		try {
			const formData = await request.formData();
			const resultId = formData.get('resultId') as string;

			// Get cached result
			const cached = previewCache.get(`result-${resultId}`) as {
				preview: ImportPreview;
				rows: AICSImportRow[];
				mergedRows: AICSImportRow[];
				timestamp: number;
				importResult?: ReturnType<typeof importUsers> extends Promise<infer T> ? T : never;
			} | undefined;

			if (!cached || !cached.importResult) {
				return fail(400, { error: 'Risultato non trovato' });
			}

			// Generate report
			const buffer = await generateSuccessReport(cached.importResult);

			return {
				success: true,
				report: buffer.toString('base64'),
				filename: `import-completato-${new Date().toISOString().split('T')[0]}.xlsx`
			};
		} catch (error) {
			logger.error({ error }, 'Error generating success report');
			return fail(500, { error: 'Errore durante la generazione del report' });
		}
	}
};
