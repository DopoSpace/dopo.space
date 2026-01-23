/**
 * Script per creare utenti di test nel database
 *
 * Crea 50 utenti con diversi stati di membership:
 * - S0: 5 utenti registrati senza membership
 * - S1: 8 utenti con profilo completo, pagamento pending
 * - S2: 3 utenti con pagamento in corso
 * - S3: 4 utenti con pagamento fallito/cancellato
 * - S4: 12 utenti pagati, in attesa tessera
 * - S5: 10 utenti attivi con tessera
 * - S6: 5 utenti con membership scaduta (numero in previousMembershipNumber)
 * - S7: 3 utenti con membership cancellata (numero in previousMembershipNumber)
 *
 * Include 5 utenti stranieri (DE, FR, ES, UK) distribuiti tra gli stati.
 *
 * Uso: pnpm seed-users
 */

import { PrismaClient, MembershipStatus, PaymentStatus } from '@prisma/client';

const prisma = new PrismaClient();

// Membership duration constant
const MEMBERSHIP_DURATION_DAYS = 365;

// Default membership fee in cents (€25.00)
const DEFAULT_MEMBERSHIP_FEE = 2500;

// Nomi italiani maschili e femminili
const maleFirstNames = [
	'Marco', 'Giuseppe', 'Luca', 'Francesco', 'Alessandro',
	'Andrea', 'Matteo', 'Lorenzo', 'Davide', 'Simone',
	'Giovanni', 'Roberto', 'Stefano', 'Paolo', 'Antonio'
];

const femaleFirstNames = [
	'Maria', 'Anna', 'Giulia', 'Francesca', 'Sara',
	'Laura', 'Chiara', 'Valentina', 'Alessia', 'Martina',
	'Elena', 'Federica', 'Silvia', 'Paola', 'Roberta'
];

const lastNames = [
	'Rossi', 'Russo', 'Ferrari', 'Esposito', 'Bianchi',
	'Romano', 'Colombo', 'Ricci', 'Marino', 'Greco',
	'Bruno', 'Gallo', 'Conti', 'De Luca', 'Costa',
	'Giordano', 'Mancini', 'Rizzo', 'Lombardi', 'Moretti',
	'Barbieri', 'Fontana', 'Santoro', 'Mariani', 'Rinaldi'
];

const provinces = ['MI', 'RM', 'NA', 'TO', 'PA', 'GE', 'BO', 'FI', 'BA', 'CT', 'VE', 'PD', 'VR', 'BS', 'MO'];
const cities: Record<string, string> = {
	'MI': 'Milano', 'RM': 'Roma', 'NA': 'Napoli', 'TO': 'Torino', 'PA': 'Palermo',
	'GE': 'Genova', 'BO': 'Bologna', 'FI': 'Firenze', 'BA': 'Bari', 'CT': 'Catania',
	'VE': 'Venezia', 'PD': 'Padova', 'VR': 'Verona', 'BS': 'Brescia', 'MO': 'Modena'
};

// Dati per utenti stranieri
const foreignUsers = [
	{ nationality: 'DE', birthCity: 'Berlin', name: 'Hans', surname: 'Mueller' },
	{ nationality: 'FR', birthCity: 'Paris', name: 'Pierre', surname: 'Dupont' },
	{ nationality: 'ES', birthCity: 'Madrid', name: 'Carlos', surname: 'Garcia' },
	{ nationality: 'UK', birthCity: 'London', name: 'James', surname: 'Smith' }
];

// Mese CF: lettere per i mesi (A=Gen, B=Feb, C=Mar, D=Apr, E=Mag, H=Giu, L=Lug, M=Ago, P=Set, R=Ott, S=Nov, T=Dic)
const monthLetters = ['A', 'B', 'C', 'D', 'E', 'H', 'L', 'M', 'P', 'R', 'S', 'T'];

// Caratteri pari e dispari per il checksum
const oddValues: Record<string, number> = {
	'0': 1, '1': 0, '2': 5, '3': 7, '4': 9, '5': 13, '6': 15, '7': 17, '8': 19, '9': 21,
	'A': 1, 'B': 0, 'C': 5, 'D': 7, 'E': 9, 'F': 13, 'G': 15, 'H': 17, 'I': 19, 'J': 21,
	'K': 2, 'L': 4, 'M': 18, 'N': 20, 'O': 11, 'P': 3, 'Q': 6, 'R': 8, 'S': 12, 'T': 14,
	'U': 16, 'V': 10, 'W': 22, 'X': 25, 'Y': 24, 'Z': 23
};
const evenValues: Record<string, number> = {
	'0': 0, '1': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9,
	'A': 0, 'B': 1, 'C': 2, 'D': 3, 'E': 4, 'F': 5, 'G': 6, 'H': 7, 'I': 8, 'J': 9,
	'K': 10, 'L': 11, 'M': 12, 'N': 13, 'O': 14, 'P': 15, 'Q': 16, 'R': 17, 'S': 18, 'T': 19,
	'U': 20, 'V': 21, 'W': 22, 'X': 23, 'Y': 24, 'Z': 25
};

function calculateChecksum(cf15: string): string {
	let sum = 0;
	for (let i = 0; i < 15; i++) {
		const char = cf15[i].toUpperCase();
		sum += i % 2 === 0 ? oddValues[char] : evenValues[char];
	}
	return String.fromCharCode(65 + (sum % 26));
}

function extractConsonants(str: string): string {
	return str.toUpperCase().replace(/[^A-Z]/g, '').replace(/[AEIOU]/g, '');
}

function extractVowels(str: string): string {
	return str.toUpperCase().replace(/[^AEIOU]/g, '');
}

function generateTaxCodePart(name: string, isName: boolean): string {
	const consonants = extractConsonants(name);
	const vowels = extractVowels(name);

	if (isName && consonants.length >= 4) {
		// Per il nome: se ci sono 4+ consonanti, prendi 1a, 3a, 4a
		return consonants[0] + consonants[2] + consonants[3];
	}

	const chars = consonants + vowels + 'XXX';
	return chars.slice(0, 3);
}

function generateValidTaxCode(firstName: string, lastName: string, birthDate: Date, isFemale: boolean): string {
	const surnamePart = generateTaxCodePart(lastName, false);
	const namePart = generateTaxCodePart(firstName, true);

	const year = String(birthDate.getFullYear()).slice(-2);
	const month = monthLetters[birthDate.getMonth()];
	let day = birthDate.getDate();
	if (isFemale) day += 40;
	const dayStr = String(day).padStart(2, '0');

	// Codice comune fittizio (H501 = Roma)
	const comuneCode = 'H501';

	const cf15 = surnamePart + namePart + year + month + dayStr + comuneCode;
	const checksum = calculateChecksum(cf15);

	return cf15 + checksum;
}

function randomPhone(): string {
	return '+39' + String(Math.floor(Math.random() * 9000000000) + 1000000000);
}

function calculateEndDate(startDate: Date): Date {
	const endDate = new Date(startDate);
	endDate.setDate(endDate.getDate() + MEMBERSHIP_DURATION_DAYS);
	return endDate;
}

interface UserData {
	type: string;
	email: string;
	name: string;
	membershipNumber?: string;
	nationality: string;
}

async function seedTestUsers() {
	console.log('🌱 Creazione utenti di test...\n');

	// Get membership fee from settings or use default
	const feeSetting = await prisma.settings.findUnique({
		where: { key: 'MEMBERSHIP_FEE' }
	});
	const membershipFee = feeSetting ? parseInt(feeSetting.value, 10) : DEFAULT_MEMBERSHIP_FEE;

	// Ensure settings exist
	if (!feeSetting) {
		await prisma.settings.create({
			data: { key: 'MEMBERSHIP_FEE', value: String(DEFAULT_MEMBERSHIP_FEE) }
		});
		console.log('📝 Creata impostazione MEMBERSHIP_FEE con valore default\n');
	}

	console.log(`💰 Quota membership: €${(membershipFee / 100).toFixed(2)}\n`);

	// Create card number ranges if they don't exist
	const existingRanges = await prisma.cardNumberRange.findMany();

	if (existingRanges.length === 0) {
		console.log('📋 Creazione range tessere di esempio...');
		await prisma.cardNumberRange.create({
			data: {
				startNumber: 1,
				endNumber: 100
			}
		});
		console.log('   ✅ Creato range: 1-100\n');
	}

	const createdUsers: UserData[] = [];
	let userIndex = 0;
	let foreignIndex = 0;
	let membershipNumberCounter = 1;

	// Helper per determinare se un utente deve essere straniero
	const shouldBeForeign = (index: number, targetIndices: number[]): boolean => {
		return targetIndices.includes(index);
	};

	// Indici per utenti stranieri (distribuiti tra vari stati)
	const foreignIndices = [7, 18, 30, 42, 48]; // S1, S4, S5, S6, S7

	// Helper per creare un utente
	async function createUser(isFemale: boolean, isForeign: boolean = false) {
		let firstName: string, lastName: string, nationality: string, birthProvince: string, birthCity: string;
		let hasForeignTaxCode = false;
		let taxCode: string | null = null;

		const birthDate = new Date(1970 + (userIndex % 40), userIndex % 12, (userIndex % 28) + 1);

		if (isForeign) {
			const foreignData = foreignUsers[foreignIndex % foreignUsers.length];
			firstName = foreignData.name;
			lastName = foreignData.surname;
			nationality = foreignData.nationality;
			birthProvince = 'EE';
			birthCity = foreignData.birthCity;
			foreignIndex++;
			// Alcuni stranieri hanno CF italiano
			if (foreignIndex % 2 === 0) {
				hasForeignTaxCode = true;
				taxCode = generateValidTaxCode(firstName, lastName, birthDate, false);
			}
		} else {
			firstName = isFemale ? femaleFirstNames[userIndex % femaleFirstNames.length] : maleFirstNames[userIndex % maleFirstNames.length];
			lastName = lastNames[userIndex % lastNames.length];
			nationality = 'IT';
			birthProvince = provinces[userIndex % provinces.length];
			birthCity = cities[birthProvince];
			taxCode = generateValidTaxCode(firstName, lastName, birthDate, isFemale);
		}

		const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}${userIndex}@test.dopo.space`;
		const province = provinces[userIndex % provinces.length];

		const user = await prisma.user.create({
			data: {
				email,
				profile: {
					create: {
						firstName,
						lastName,
						birthDate,
						taxCode,
						nationality,
						birthProvince,
						birthCity,
						hasForeignTaxCode,
						address: `Via Roma ${userIndex + 1}`,
						city: cities[province] || 'Milano',
						postalCode: String(20100 + userIndex).slice(0, 5),
						province,
						phone: Math.random() > 0.3 ? randomPhone() : null,
						privacyConsent: true,
						dataConsent: true,
						profileComplete: true
					}
				}
			}
		});

		userIndex++;
		return { user, firstName, lastName, email, nationality };
	}

	try {
		// ==================== S0: 5 utenti senza membership ====================
		console.log('👥 Creazione 5 utenti in stato S0 (registrati, senza membership)...');
		for (let i = 0; i < 5; i++) {
			const isFemale = i % 2 === 1;
			const { firstName, lastName, email, nationality } = await createUser(isFemale);
			createdUsers.push({ type: 'S0', email, name: `${firstName} ${lastName}`, nationality });
		}

		// ==================== S1: 8 utenti con pagamento pending ====================
		console.log('👥 Creazione 8 utenti in stato S1 (profilo completo, pagamento pending)...');
		for (let i = 0; i < 8; i++) {
			const isFemale = i % 2 === 1;
			const isForeign = shouldBeForeign(userIndex, foreignIndices);
			const { user, firstName, lastName, email, nationality } = await createUser(isFemale, isForeign);

			await prisma.membership.create({
				data: {
					userId: user.id,
					status: MembershipStatus.PENDING,
					paymentStatus: PaymentStatus.PENDING,
					paymentAmount: membershipFee
				}
			});

			createdUsers.push({ type: 'S1', email, name: `${firstName} ${lastName}`, nationality });
		}

		// ==================== S2: 3 utenti con pagamento in corso ====================
		console.log('👥 Creazione 3 utenti in stato S2 (pagamento in corso)...');
		for (let i = 0; i < 3; i++) {
			const isFemale = i % 2 === 1;
			const { user, firstName, lastName, email, nationality } = await createUser(isFemale);

			await prisma.membership.create({
				data: {
					userId: user.id,
					status: MembershipStatus.PENDING,
					paymentStatus: PaymentStatus.PENDING,
					paymentProviderId: `PAYPAL-ORDER-${Date.now()}-${i}`,
					paymentAmount: membershipFee
				}
			});

			createdUsers.push({ type: 'S2', email, name: `${firstName} ${lastName}`, nationality });
		}

		// ==================== S3: 4 utenti con pagamento fallito ====================
		console.log('👥 Creazione 4 utenti in stato S3 (pagamento fallito/cancellato)...');
		for (let i = 0; i < 4; i++) {
			const isFemale = i % 2 === 1;
			const { user, firstName, lastName, email, nationality } = await createUser(isFemale);

			await prisma.membership.create({
				data: {
					userId: user.id,
					status: MembershipStatus.PENDING,
					paymentStatus: i % 2 === 0 ? PaymentStatus.FAILED : PaymentStatus.CANCELED,
					paymentProviderId: `PAYPAL-ORDER-FAILED-${i}`,
					paymentAmount: membershipFee
				}
			});

			createdUsers.push({ type: 'S3', email, name: `${firstName} ${lastName}`, nationality });
		}

		// ==================== S4: 12 utenti pagati senza tessera ====================
		console.log('👥 Creazione 12 utenti in stato S4 (pagato, in attesa tessera)...');
		for (let i = 0; i < 12; i++) {
			const isFemale = i % 2 === 1;
			const isForeign = shouldBeForeign(userIndex, foreignIndices);
			const { user, firstName, lastName, email, nationality } = await createUser(isFemale, isForeign);

			// S4: Payment succeeded but no card yet, no dates set
			await prisma.membership.create({
				data: {
					userId: user.id,
					status: MembershipStatus.PENDING,
					paymentStatus: PaymentStatus.SUCCEEDED,
					paymentProviderId: `PAYPAL-ORDER-SUCCESS-${i}`,
					paymentAmount: membershipFee
				}
			});

			createdUsers.push({ type: 'S4', email, name: `${firstName} ${lastName}`, nationality });
		}

		// ==================== S5: 10 utenti attivi con tessera ====================
		console.log('👥 Creazione 10 utenti in stato S5 (attivo con tessera)...');
		for (let i = 0; i < 10; i++) {
			const isFemale = i % 2 === 1;
			const isForeign = shouldBeForeign(userIndex, foreignIndices);
			const { user, firstName, lastName, email, nationality } = await createUser(isFemale, isForeign);
			const membershipNumber = String(membershipNumberCounter++);

			// Rolling 365 day membership starting 30 days ago
			const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
			const endDate = calculateEndDate(startDate);

			await prisma.membership.create({
				data: {
					userId: user.id,
					membershipNumber,
					status: MembershipStatus.ACTIVE,
					paymentStatus: PaymentStatus.SUCCEEDED,
					paymentProviderId: `PAYPAL-ORDER-ACTIVE-${i}`,
					paymentAmount: membershipFee,
					startDate,
					endDate,
					cardAssignedAt: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000) // 25 giorni fa
				}
			});

			createdUsers.push({ type: 'S5', email, name: `${firstName} ${lastName}`, membershipNumber, nationality });
		}

		// ==================== S6: 5 utenti con membership scaduta ====================
		// Nota: Quando una membership scade, il numero viene spostato in previousMembershipNumber
		// e membershipNumber, startDate, endDate vengono svuotati
		console.log('👥 Creazione 5 utenti in stato S6 (membership scaduta)...');
		for (let i = 0; i < 5; i++) {
			const isFemale = i % 2 === 1;
			const isForeign = shouldBeForeign(userIndex, foreignIndices);
			const { user, firstName, lastName, email, nationality } = await createUser(isFemale, isForeign);
			const previousNumber = String(membershipNumberCounter++);

			await prisma.membership.create({
				data: {
					userId: user.id,
					membershipNumber: null, // Svuotato alla scadenza
					previousMembershipNumber: previousNumber, // Numero precedente salvato
					status: MembershipStatus.EXPIRED,
					paymentStatus: PaymentStatus.SUCCEEDED,
					paymentProviderId: `PAYPAL-ORDER-EXPIRED-${i}`,
					paymentAmount: membershipFee,
					startDate: null, // Svuotato alla scadenza
					endDate: null, // Svuotato alla scadenza
					cardAssignedAt: null
				}
			});

			createdUsers.push({ type: 'S6', email, name: `${firstName} ${lastName}`, membershipNumber: previousNumber, nationality });
		}

		// ==================== S7: 3 utenti con membership cancellata ====================
		// Nota: Quando una membership viene cancellata dall'admin, il numero viene spostato in previousMembershipNumber
		console.log('👥 Creazione 3 utenti in stato S7 (membership cancellata)...');
		for (let i = 0; i < 3; i++) {
			const isFemale = i % 2 === 1;
			const { user, firstName, lastName, email, nationality } = await createUser(isFemale);
			const previousNumber = String(membershipNumberCounter++);

			await prisma.membership.create({
				data: {
					userId: user.id,
					membershipNumber: null, // Svuotato alla cancellazione
					previousMembershipNumber: previousNumber, // Numero precedente salvato
					status: MembershipStatus.CANCELED,
					paymentStatus: PaymentStatus.SUCCEEDED,
					paymentProviderId: `PAYPAL-ORDER-CANCELED-${i}`,
					paymentAmount: membershipFee,
					startDate: null, // Svuotato alla cancellazione
					endDate: null, // Svuotato alla cancellazione
					cardAssignedAt: null
				}
			});

			createdUsers.push({ type: 'S7', email, name: `${firstName} ${lastName}`, membershipNumber: previousNumber, nationality });
		}

		// ==================== RIEPILOGO ====================
		console.log('\n✅ Utenti di test creati con successo!\n');
		console.log('📊 Riepilogo:');
		console.log('─'.repeat(80));

		const states = ['S0', 'S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7'];
		const stateDescriptions: Record<string, string> = {
			'S0': 'Registrato, senza membership',
			'S1': 'Profilo completo, pagamento pending',
			'S2': 'Pagamento in corso',
			'S3': 'Pagamento fallito/cancellato',
			'S4': 'Pagato, in attesa tessera',
			'S5': 'Attivo con tessera',
			'S6': 'Membership scaduta',
			'S7': 'Membership cancellata'
		};
		const stateEmojis: Record<string, string> = {
			'S0': '⚫', 'S1': '⚪', 'S2': '🔵', 'S3': '🔴', 'S4': '🟡', 'S5': '🟢', 'S6': '🟤', 'S7': '⛔'
		};

		for (const state of states) {
			const users = createdUsers.filter(u => u.type === state);
			const foreignCount = users.filter(u => u.nationality !== 'IT').length;
			console.log(`\n${stateEmojis[state]} ${state} - ${stateDescriptions[state]} (${users.length}${foreignCount > 0 ? `, ${foreignCount} stranieri` : ''}):`);
			users.forEach(u => {
				const flag = u.nationality !== 'IT' ? ` 🌍${u.nationality}` : '';
				const card = u.membershipNumber ? ` [${u.membershipNumber}]` : '';
				console.log(`   ${u.name}${flag} <${u.email}>${card}`);
			});
		}

		console.log('\n' + '─'.repeat(80));
		console.log(`📈 Totale: ${createdUsers.length} utenti`);
		console.log(`🌍 Stranieri: ${createdUsers.filter(u => u.nationality !== 'IT').length} utenti`);
		console.log('\n💡 Test disponibili:');
		console.log('   - /admin/users → Gestisci utenti');
		console.log('   - /admin/card-ranges → Gestisci range tessere');
		console.log('   - /admin/maintenance → Manutenzione (controllo scadenze)');
		console.log('   - /admin/export?format=aics → Export AICS');

	} catch (error) {
		console.error('❌ Errore durante la creazione degli utenti:', error);
		process.exit(1);
	} finally {
		await prisma.$disconnect();
	}
}

seedTestUsers();
