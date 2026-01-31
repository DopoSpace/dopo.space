/**
 * Script per verificare e correggere i dati del profilo utente rispetto al Codice Fiscale.
 *
 * Il CF è la fonte di verità: se i dati del profilo non corrispondono,
 * vengono corretti con quelli estratti dal CF.
 *
 * Uso:
 *   pnpm verify-cf              # Dry-run: mostra discrepanze senza modificare il DB
 *   pnpm verify-cf -- --fix     # Applica le correzioni al DB
 */

import { PrismaClient } from '@prisma/client';
import { getBirthPlaceFromTaxCode, type MunicipalityInfo } from '../src/lib/server/data/cadastral-codes';

const prisma = new PrismaClient();

const FIX_MODE = process.argv.includes('--fix');

// ---------------------------------------------------------------------------
// Birth date extraction (inlined to avoid $lib alias issues with tsx)
// ---------------------------------------------------------------------------

const OMOCODIA_REVERSE: Record<string, string> = {
	L: '0', M: '1', N: '2', P: '3', Q: '4',
	R: '5', S: '6', T: '7', U: '8', V: '9'
};
const OMOCODIA_POSITIONS = [6, 7, 9, 10, 12, 13, 14];

const MONTH_CODES: Record<string, number> = {
	A: 1, B: 2, C: 3, D: 4, E: 5, H: 6,
	L: 7, M: 8, P: 9, R: 10, S: 11, T: 12
};

function normalizeOmocodia(cf: string): string {
	const chars = cf.toUpperCase().split('');
	for (const pos of OMOCODIA_POSITIONS) {
		const char = chars[pos];
		if (OMOCODIA_REVERSE[char] !== undefined) {
			chars[pos] = OMOCODIA_REVERSE[char];
		}
	}
	return chars.join('');
}

function extractBirthDate(cf: string): { day: number; month: number; year: number } | null {
	if (!cf || cf.length !== 16) return null;

	const normalized = normalizeOmocodia(cf.toUpperCase());

	const yearStr = normalized.substring(6, 8);
	let year = parseInt(yearStr, 10);
	if (isNaN(year)) return null;

	const currentYear = new Date().getFullYear();
	const currentCentury = Math.floor(currentYear / 100) * 100;
	const twoDigitCurrentYear = currentYear % 100;
	year = year <= twoDigitCurrentYear + 10
		? currentCentury + year
		: currentCentury - 100 + year;

	const monthCode = normalized.charAt(8);
	const month = MONTH_CODES[monthCode];
	if (!month) return null;

	const dayStr = normalized.substring(9, 11);
	let day = parseInt(dayStr, 10);
	if (isNaN(day)) return null;
	if (day > 40) day -= 40;

	return { day, month, year };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Normalize a string for comparison: uppercase, trim, strip accents */
function normalize(value: string | null | undefined): string {
	if (!value) return '';
	return value
		.toUpperCase()
		.trim()
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '');
}

/** Format a Date as YYYY-MM-DD (UTC) for display */
function fmtDate(d: Date | null | undefined): string {
	if (!d) return '(vuoto)';
	return d.toISOString().slice(0, 10);
}

interface Mismatch {
	field: string;
	dbValue: string;
	cfValue: string;
}

interface ProfileCorrection {
	userId: string;
	profileId: string;
	email: string;
	name: string;
	taxCode: string;
	mismatches: Mismatch[];
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
	console.log('='.repeat(60));
	console.log(FIX_MODE ? '  MODALITA FIX — le correzioni verranno scritte nel DB' : '  DRY-RUN — nessuna modifica al DB');
	console.log('='.repeat(60));
	console.log();

	const profiles = await prisma.userProfile.findMany({
		where: { taxCode: { not: null } },
		include: { user: true }
	});

	console.log(`Profili con CF trovati: ${profiles.length}\n`);

	const corrections: ProfileCorrection[] = [];
	const errors: { email: string; taxCode: string; error: string }[] = [];

	for (const profile of profiles) {
		const cf = profile.taxCode!;

		// --- Birth date ---
		const cfDate = extractBirthDate(cf);
		if (!cfDate) {
			errors.push({
				email: profile.user.email,
				taxCode: cf,
				error: 'Impossibile estrarre la data di nascita dal CF'
			});
			continue;
		}

		// --- Birth place ---
		let cfPlace: MunicipalityInfo | null = null;
		try {
			cfPlace = await getBirthPlaceFromTaxCode(cf);
		} catch {
			errors.push({
				email: profile.user.email,
				taxCode: cf,
				error: 'Errore nel lookup del luogo di nascita dal CF'
			});
			continue;
		}

		const mismatches: Mismatch[] = [];
		const updates: Record<string, Date | string> = {};

		// Compare birth date (UTC)
		const cfBirthDate = new Date(Date.UTC(cfDate.year, cfDate.month - 1, cfDate.day));
		if (profile.birthDate) {
			const dbDay = profile.birthDate.getUTCDate();
			const dbMonth = profile.birthDate.getUTCMonth() + 1;
			const dbYear = profile.birthDate.getUTCFullYear();

			if (dbDay !== cfDate.day || dbMonth !== cfDate.month || dbYear !== cfDate.year) {
				mismatches.push({
					field: 'birthDate',
					dbValue: fmtDate(profile.birthDate),
					cfValue: fmtDate(cfBirthDate)
				});
				updates.birthDate = cfBirthDate;
			}
		} else {
			mismatches.push({
				field: 'birthDate',
				dbValue: '(vuoto)',
				cfValue: fmtDate(cfBirthDate)
			});
			updates.birthDate = cfBirthDate;
		}

		// Compare birth city and province
		if (cfPlace) {
			const normalizedDbCity = normalize(profile.birthCity);
			const normalizedCfCity = normalize(cfPlace.name);

			if (normalizedDbCity !== normalizedCfCity) {
				mismatches.push({
					field: 'birthCity',
					dbValue: profile.birthCity || '(vuoto)',
					cfValue: cfPlace.name
				});
				updates.birthCity = cfPlace.name;
			}

			const normalizedDbProvince = normalize(profile.birthProvince);
			const normalizedCfProvince = normalize(cfPlace.province);

			if (normalizedDbProvince !== normalizedCfProvince) {
				mismatches.push({
					field: 'birthProvince',
					dbValue: profile.birthProvince || '(vuoto)',
					cfValue: cfPlace.province
				});
				updates.birthProvince = cfPlace.province;
			}
		}

		if (mismatches.length > 0) {
			corrections.push({
				userId: profile.userId,
				profileId: profile.id,
				email: profile.user.email,
				name: `${profile.firstName} ${profile.lastName}`,
				taxCode: cf,
				mismatches
			});

			if (FIX_MODE) {
				await prisma.userProfile.update({
					where: { id: profile.id },
					data: updates
				});
			}
		}
	}

	// --- Report ---
	console.log('-'.repeat(60));
	console.log('REPORT');
	console.log('-'.repeat(60));

	if (corrections.length === 0) {
		console.log('\nNessuna discrepanza trovata.');
	} else {
		console.log(`\nDiscrepanze trovate: ${corrections.length}\n`);
		for (const c of corrections) {
			console.log(`  ${c.name} (${c.email}) — CF: ${c.taxCode}`);
			for (const m of c.mismatches) {
				console.log(`    ${m.field}: "${m.dbValue}" -> "${m.cfValue}"`);
			}
			console.log();
		}
	}

	if (errors.length > 0) {
		console.log(`Errori: ${errors.length}\n`);
		for (const e of errors) {
			console.log(`  ${e.email} (CF: ${e.taxCode}): ${e.error}`);
		}
		console.log();
	}

	console.log('-'.repeat(60));
	console.log(`Totale verificati: ${profiles.length}`);
	console.log(`Corretti:          ${corrections.length}${FIX_MODE ? ' (scritti nel DB)' : ' (dry-run, non scritti)'}`);
	console.log(`Errori:            ${errors.length}`);
	console.log('-'.repeat(60));
}

main()
	.catch((err) => {
		console.error('Errore fatale:', err);
		process.exit(1);
	})
	.finally(() => prisma.$disconnect());
