/**
 * Script per correggere nome/cognome invertiti nel DB rispetto al Codice Fiscale.
 *
 * Il problema principale: durante un import bulk, firstName e lastName sono stati
 * salvati invertiti per la maggior parte degli utenti. Il CF è la fonte di verità.
 *
 * Logica:
 *   1. Se i codici CF corrispondono ai dati attuali → OK, skip
 *   2. Se i codici CF corrispondono ai dati INVERTITI → swap firstName ↔ lastName
 *   3. Altrimenti → log per revisione manuale (nomi composti, traslitterazioni, ecc.)
 *
 * Uso:
 *   pnpm fix-names              # Dry-run: mostra le modifiche senza applicarle
 *   pnpm fix-names -- --fix     # Applica le correzioni al DB
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const FIX_MODE = process.argv.includes('--fix');

// ---------------------------------------------------------------------------
// CF name/surname code generation (inlined to avoid $lib alias issues with tsx)
// ---------------------------------------------------------------------------

function extractConsonants(str: string): string {
	return str.toUpperCase().replace(/[^BCDFGHJKLMNPQRSTVWXYZ]/g, '');
}

function extractVowels(str: string): string {
	return str.toUpperCase().replace(/[^AEIOU]/g, '');
}

function generateSurnameCode(surname: string): string {
	const combined = extractConsonants(surname) + extractVowels(surname) + 'XXX';
	return combined.substring(0, 3);
}

function generateNameCode(name: string): string {
	const consonants = extractConsonants(name);
	if (consonants.length >= 4) {
		return consonants[0] + consonants[2] + consonants[3];
	}
	const combined = consonants + extractVowels(name) + 'XXX';
	return combined.substring(0, 3);
}

// ---------------------------------------------------------------------------
// Omocodia normalization
// ---------------------------------------------------------------------------

const OMOCODIA_REVERSE: Record<string, string> = {
	L: '0', M: '1', N: '2', P: '3', Q: '4',
	R: '5', S: '6', T: '7', U: '8', V: '9'
};
const OMOCODIA_POSITIONS = [6, 7, 9, 10, 12, 13, 14];

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

// ---------------------------------------------------------------------------
// CF format validation
// ---------------------------------------------------------------------------

const CF_REGEX = /^[A-Z]{6}[0-9LMNPQRSTUV]{2}[A-Z][0-9LMNPQRSTUV]{2}[A-Z][0-9LMNPQRSTUV]{3}[A-Z]$/;

function isValidCFFormat(cf: string): boolean {
	return cf.length === 16 && CF_REGEX.test(cf);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
	console.log('='.repeat(70));
	console.log(FIX_MODE
		? '  MODALITA FIX — le correzioni verranno scritte nel DB'
		: '  DRY-RUN — nessuna modifica al DB');
	console.log('='.repeat(70));
	console.log();

	const profiles = await prisma.userProfile.findMany({
		where: {
			taxCode: { not: null, notIn: ['0000000000000000', ''] }
		},
		include: {
			user: { select: { email: true } }
		}
	});

	console.log(`Trovati ${profiles.length} profili con CF`);
	console.log();

	let checked = 0;
	let correct = 0;
	let swapped = 0;
	let unclear = 0;
	let fixedCount = 0;
	let failedCount = 0;

	const swappedList: { email: string; firstName: string; lastName: string }[] = [];
	const unclearList: { email: string; firstName: string; lastName: string; taxCode: string; cfSurname: string; cfName: string; expSurname: string; expName: string }[] = [];

	for (const profile of profiles) {
		const cf = profile.taxCode!.toUpperCase();
		const firstName = profile.firstName || '';
		const lastName = profile.lastName || '';

		if (!firstName || !lastName) continue;
		if (!isValidCFFormat(cf)) continue;

		checked++;

		const normalized = normalizeOmocodia(cf);
		const cfSurnameCode = normalized.substring(0, 3);
		const cfNameCode = normalized.substring(3, 6);

		// Check current assignment: lastName → surname code, firstName → name code
		const currentSurnameCode = generateSurnameCode(lastName);
		const currentNameCode = generateNameCode(firstName);

		if (cfSurnameCode === currentSurnameCode && cfNameCode === currentNameCode) {
			correct++;
			continue;
		}

		// Check swapped: firstName → surname code, lastName → name code
		const swappedSurnameCode = generateSurnameCode(firstName);
		const swappedNameCode = generateNameCode(lastName);

		if (cfSurnameCode === swappedSurnameCode && cfNameCode === swappedNameCode) {
			swapped++;
			swappedList.push({ email: profile.user.email, firstName, lastName });

			console.log(`  SWAP: ${profile.user.email} — "${firstName}" ↔ "${lastName}"`);

			if (FIX_MODE) {
				try {
					await prisma.userProfile.update({
						where: { id: profile.id },
						data: { firstName: lastName, lastName: firstName }
					});
					fixedCount++;
				} catch (err) {
					failedCount++;
					console.error(`    ERRORE: ${profile.user.email}`, err);
				}
			}
		} else {
			unclear++;
			unclearList.push({
				email: profile.user.email,
				firstName,
				lastName,
				taxCode: cf,
				cfSurname: cfSurnameCode,
				cfName: cfNameCode,
				expSurname: currentSurnameCode,
				expName: currentNameCode
			});
		}
	}

	// ---------------------------------------------------------------------------
	// Report
	// ---------------------------------------------------------------------------

	console.log();
	console.log('='.repeat(70));
	console.log('  RISULTATI');
	console.log('='.repeat(70));
	console.log(`  Controllati:    ${checked}`);
	console.log(`  Corretti:       ${correct}`);
	console.log(`  Invertiti:      ${swapped}`);
	console.log(`  Da verificare:  ${unclear}`);

	if (FIX_MODE && swapped > 0) {
		console.log();
		console.log(`  Aggiornati:     ${fixedCount}`);
		console.log(`  Falliti:        ${failedCount}`);
	}

	if (unclearList.length > 0) {
		console.log();
		console.log('-'.repeat(70));
		console.log('  PROFILI DA VERIFICARE MANUALMENTE');
		console.log('-'.repeat(70));

		for (const u of unclearList) {
			console.log();
			console.log(`  ${u.email}`);
			console.log(`    CF: ${u.taxCode}`);
			console.log(`    DB:  firstName="${u.firstName}" lastName="${u.lastName}"`);
			console.log(`    CF codes:  surname=${u.cfSurname} name=${u.cfName}`);
			console.log(`    Expected:  surname=${u.expSurname} name=${u.expName}`);
		}
	}

	if (!FIX_MODE && swapped > 0) {
		console.log();
		console.log('-'.repeat(70));
		console.log('  Per applicare le correzioni, esegui:');
		console.log('    pnpm fix-names -- --fix');
		console.log('-'.repeat(70));
	}
}

main()
	.catch((err) => {
		console.error('Errore fatale:', err);
		process.exit(1);
	})
	.finally(() => prisma.$disconnect());
