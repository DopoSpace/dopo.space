/**
 * Script per correggere i nomi che non corrispondono al Codice Fiscale.
 *
 * Per ogni utente con un CF valido, verifica che il codice nome/cognome
 * nel CF corrisponda al nome/cognome salvato nel DB.
 * Se non corrisponde, prova a trovare un nome composto che matchi
 * (es. "Bianca" → "Bianca Maria").
 *
 * Uso:
 *   pnpm fix-names              # Dry-run: mostra discrepanze senza modificare il DB
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
// Gender extraction from CF
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

function extractGenderFromCF(cf: string): 'M' | 'F' | null {
	if (!cf || cf.length !== 16) return null;
	const normalized = normalizeOmocodia(cf.toUpperCase());
	const day = parseInt(normalized.substring(9, 11), 10);
	if (isNaN(day)) return null;
	return day > 40 ? 'F' : 'M';
}

// ---------------------------------------------------------------------------
// Italian names database (loaded dynamically)
// ---------------------------------------------------------------------------

async function loadNamesDatabase(): Promise<Record<string, 'M' | 'F'>> {
	// Import the names database using dynamic import with the actual file path
	const path = await import('path');
	const fs = await import('fs');

	const namesPath = path.join(process.cwd(), 'src/lib/server/data/italian-names.ts');
	const content = fs.readFileSync(namesPath, 'utf-8');

	// Extract the ITALIAN_NAMES object from the file
	const names: Record<string, 'M' | 'F'> = {};
	const regex = /^\t(\w+):\s*'([MF])'/gm;
	let match;
	while ((match = regex.exec(content)) !== null) {
		names[match[1]] = match[2] as 'M' | 'F';
	}

	return names;
}

// ---------------------------------------------------------------------------
// Compound name suggestion
// ---------------------------------------------------------------------------

function suggestCompoundName(
	cf: string,
	firstName: string,
	namesDatabase: Record<string, 'M' | 'F'>
): string | null {
	const upper = cf.toUpperCase();
	const cfNameCode = upper.substring(3, 6);
	const currentNameCode = generateNameCode(firstName);

	if (cfNameCode === currentNameCode) return null;

	const gender = extractGenderFromCF(cf);

	for (const [candidateName, candidateGender] of Object.entries(namesDatabase)) {
		if (gender && candidateGender !== gender) continue;
		if (candidateName.toUpperCase() === firstName.toUpperCase()) continue;

		const compound = `${firstName} ${candidateName}`;
		if (generateNameCode(compound) === cfNameCode) {
			return firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase() +
				' ' + candidateName.charAt(0).toUpperCase() + candidateName.slice(1).toLowerCase();
		}
	}

	return null;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface NameIssue {
	userId: string;
	profileId: string;
	email: string;
	taxCode: string;
	type: 'name' | 'surname' | 'both';
	currentFirstName: string;
	currentLastName: string;
	cfNameCode: string;
	cfSurnameCode: string;
	expectedNameCode: string;
	expectedSurnameCode: string;
	suggestedFirstName: string | null;
	fixed: boolean;
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

	console.log('Caricamento database nomi...');
	const namesDatabase = await loadNamesDatabase();
	console.log(`  ${Object.keys(namesDatabase).length} nomi caricati`);
	console.log();

	// Fetch all profiles with a valid tax code (16 chars, not all zeros)
	const profiles = await prisma.userProfile.findMany({
		where: {
			taxCode: {
				not: null,
				notIn: ['0000000000000000', '']
			}
		},
		include: {
			user: { select: { email: true } }
		}
	});

	console.log(`Trovati ${profiles.length} profili con CF valido`);
	console.log();

	const issues: NameIssue[] = [];
	let checked = 0;
	let nameOnly = 0;
	let surnameOnly = 0;
	let both = 0;
	let fixable = 0;
	let notFixable = 0;

	for (const profile of profiles) {
		const cf = profile.taxCode!.toUpperCase();
		const firstName = profile.firstName || '';
		const lastName = profile.lastName || '';

		if (!firstName || !lastName || cf.length !== 16) continue;

		// Validate CF format (basic check)
		if (!/^[A-Z]{6}[0-9LMNPQRSTUV]{2}[A-Z][0-9LMNPQRSTUV]{2}[A-Z][0-9LMNPQRSTUV]{3}[A-Z]$/.test(cf)) {
			continue;
		}

		checked++;

		const cfSurnameCode = cf.substring(0, 3);
		const cfNameCode = cf.substring(3, 6);
		const expectedSurnameCode = generateSurnameCode(lastName);
		const expectedNameCode = generateNameCode(firstName);

		const surnameMismatch = cfSurnameCode !== expectedSurnameCode;
		const nameMismatch = cfNameCode !== expectedNameCode;

		if (!surnameMismatch && !nameMismatch) continue;

		const type: NameIssue['type'] = surnameMismatch && nameMismatch ? 'both'
			: nameMismatch ? 'name'
			: 'surname';

		if (type === 'name') nameOnly++;
		else if (type === 'surname') surnameOnly++;
		else both++;

		// Try to suggest a compound name (only for name mismatches)
		let suggestedFirstName: string | null = null;
		if (nameMismatch) {
			suggestedFirstName = suggestCompoundName(cf, firstName, namesDatabase);
		}

		if (suggestedFirstName) fixable++;
		else notFixable++;

		const issue: NameIssue = {
			userId: profile.userId,
			profileId: profile.id,
			email: profile.user.email,
			taxCode: cf,
			type,
			currentFirstName: firstName,
			currentLastName: lastName,
			cfNameCode,
			cfSurnameCode,
			expectedNameCode,
			expectedSurnameCode,
			suggestedFirstName,
			fixed: false
		};

		issues.push(issue);
	}

	// ---------------------------------------------------------------------------
	// Report
	// ---------------------------------------------------------------------------

	console.log(`Controllati: ${checked} profili`);
	console.log(`Discrepanze trovate: ${issues.length}`);
	console.log(`  - Solo nome: ${nameOnly}`);
	console.log(`  - Solo cognome: ${surnameOnly}`);
	console.log(`  - Entrambi: ${both}`);
	console.log(`  - Correggibili (nome composto trovato): ${fixable}`);
	console.log(`  - Non correggibili automaticamente: ${notFixable}`);
	console.log();

	if (issues.length === 0) {
		console.log('Nessuna discrepanza trovata. Tutti i nomi corrispondono ai CF.');
		return;
	}

	// Print detailed report
	console.log('-'.repeat(70));
	console.log('DETTAGLIO DISCREPANZE');
	console.log('-'.repeat(70));

	for (const issue of issues) {
		const icon = issue.suggestedFirstName ? '🔧' : '⚠️';
		console.log();
		console.log(`${icon} ${issue.email}`);
		console.log(`  CF: ${issue.taxCode}`);

		if (issue.type === 'name' || issue.type === 'both') {
			console.log(`  Nome DB: "${issue.currentFirstName}" → codice ${issue.expectedNameCode}`);
			console.log(`  Nome CF: codice ${issue.cfNameCode}`);
		}

		if (issue.type === 'surname' || issue.type === 'both') {
			console.log(`  Cognome DB: "${issue.currentLastName}" → codice ${issue.expectedSurnameCode}`);
			console.log(`  Cognome CF: codice ${issue.cfSurnameCode}`);
		}

		if (issue.suggestedFirstName) {
			console.log(`  ✅ Correzione: "${issue.currentFirstName}" → "${issue.suggestedFirstName}"`);
		} else {
			console.log(`  ❌ Nessuna correzione automatica disponibile`);
		}
	}

	// ---------------------------------------------------------------------------
	// Apply fixes
	// ---------------------------------------------------------------------------

	if (FIX_MODE) {
		const toFix = issues.filter(i => i.suggestedFirstName);

		if (toFix.length === 0) {
			console.log();
			console.log('Nessuna correzione automatica da applicare.');
			return;
		}

		console.log();
		console.log('-'.repeat(70));
		console.log(`APPLICAZIONE CORREZIONI (${toFix.length} profili)`);
		console.log('-'.repeat(70));

		let fixed = 0;
		let failed = 0;

		for (const issue of toFix) {
			try {
				await prisma.userProfile.update({
					where: { id: issue.profileId },
					data: { firstName: issue.suggestedFirstName! }
				});
				issue.fixed = true;
				fixed++;
				console.log(`  ✅ ${issue.email}: "${issue.currentFirstName}" → "${issue.suggestedFirstName}"`);
			} catch (err) {
				failed++;
				console.error(`  ❌ ${issue.email}: errore durante l'aggiornamento`, err);
			}
		}

		console.log();
		console.log(`Risultato: ${fixed} corretti, ${failed} falliti`);
	} else {
		console.log();
		console.log('-'.repeat(70));
		console.log('Per applicare le correzioni, esegui:');
		console.log('  pnpm fix-names -- --fix');
		console.log('-'.repeat(70));
	}
}

main()
	.catch(console.error)
	.finally(() => prisma.$disconnect());
