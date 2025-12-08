/**
 * Script per creare utenti di test nel database
 *
 * Crea 20 utenti con diversi stati di membership:
 * - 10 utenti che hanno pagato ma non hanno la tessera (S4)
 * - 3 utenti che hanno pagato e hanno la tessera (S5)
 * - 7 utenti che non hanno ancora pagato (S0/S1)
 *
 * Crea anche range di tessere di esempio per testare l'assegnazione.
 *
 * Uso: pnpm seed-users
 */

import { PrismaClient, MembershipStatus, PaymentStatus } from '@prisma/client';

const prisma = new PrismaClient();

// Nomi e cognomi italiani per generare utenti realistici
const firstNames = [
	'Marco', 'Giuseppe', 'Luca', 'Francesco', 'Alessandro',
	'Andrea', 'Matteo', 'Lorenzo', 'Davide', 'Simone',
	'Maria', 'Anna', 'Giulia', 'Francesca', 'Sara',
	'Laura', 'Chiara', 'Valentina', 'Alessia', 'Martina'
];

const lastNames = [
	'Rossi', 'Russo', 'Ferrari', 'Esposito', 'Bianchi',
	'Romano', 'Colombo', 'Ricci', 'Marino', 'Greco',
	'Bruno', 'Gallo', 'Conti', 'De Luca', 'Costa',
	'Giordano', 'Mancini', 'Rizzo', 'Lombardi', 'Moretti'
];

const provinces = ['MI', 'RM', 'NA', 'TO', 'PA', 'GE', 'BO', 'FI', 'BA', 'CT'];
const cities = [
	'Milano', 'Roma', 'Napoli', 'Torino', 'Palermo',
	'Genova', 'Bologna', 'Firenze', 'Bari', 'Catania'
];

function randomElement<T>(arr: T[]): T {
	return arr[Math.floor(Math.random() * arr.length)];
}

function generateTaxCode(): string {
	const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
	const code =
		Array(6).fill(0).map(() => letters[Math.floor(Math.random() * 26)]).join('') +
		String(Math.floor(Math.random() * 100)).padStart(2, '0') +
		letters[Math.floor(Math.random() * 26)] +
		String(Math.floor(Math.random() * 100)).padStart(2, '0') +
		letters[Math.floor(Math.random() * 26)] +
		String(Math.floor(Math.random() * 1000)).padStart(3, '0') +
		letters[Math.floor(Math.random() * 26)];
	return code;
}

async function seedTestUsers() {
	console.log('🌱 Creazione utenti di test...\n');

	// Get active association year
	const associationYear = await prisma.associationYear.findFirst({
		where: { isActive: true }
	});

	if (!associationYear) {
		console.error('❌ Nessun anno associativo attivo trovato.');
		console.log('   Esegui prima: pnpm manage-year seed');
		process.exit(1);
	}

	console.log(`📅 Anno associativo: ${associationYear.id}`);
	console.log(`💰 Quota: €${(associationYear.membershipFee / 100).toFixed(2)}\n`);

	// Create card number ranges if they don't exist
	const existingRanges = await prisma.cardNumberRange.findMany({
		where: { associationYearId: associationYear.id }
	});

	if (existingRanges.length === 0) {
		console.log('📋 Creazione range tessere di esempio...');

		// Range 1: 1-50
		await prisma.cardNumberRange.create({
			data: {
				prefix: 'DOPO-',
				startNumber: 1,
				endNumber: 50,
				padding: 3,
				associationYearId: associationYear.id
			}
		});

		// Range 2: 100-150 (saltiamo 51-99 per simulare gap)
		await prisma.cardNumberRange.create({
			data: {
				prefix: 'DOPO-',
				startNumber: 100,
				endNumber: 150,
				padding: 3,
				associationYearId: associationYear.id
			}
		});

		console.log('   ✅ Creati range: DOPO-001 a DOPO-050, DOPO-100 a DOPO-150\n');
	} else {
		console.log(`📋 Range esistenti: ${existingRanges.length} range già configurati\n`);
	}

	const createdUsers: { type: string; email: string; name: string; membershipNumber?: string }[] = [];

	// Helper to create a user with profile
	async function createUser(index: number) {
		const firstName = firstNames[index % firstNames.length];
		const lastName = lastNames[index % lastNames.length];
		const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}${index}@test.dopo.space`;
		const cityIndex = index % cities.length;

		const user = await prisma.user.create({
			data: {
				email,
				profile: {
					create: {
						firstName,
						lastName,
						birthDate: new Date(1980 + (index % 30), index % 12, (index % 28) + 1),
						taxCode: generateTaxCode(),
						address: `Via Roma ${index + 1}`,
						city: cities[cityIndex],
						postalCode: String(20100 + index).slice(0, 5),
						province: provinces[cityIndex],
						privacyConsent: true,
						dataConsent: true,
						profileComplete: true
					}
				}
			}
		});

		return { user, firstName, lastName, email };
	}

	try {
		// 1. Create 10 users with paid membership but no card (S4 - AWAITING_NUMBER)
		console.log('👥 Creazione 10 utenti in stato S4 (pagato, senza tessera)...');
		for (let i = 0; i < 10; i++) {
			const { user, firstName, lastName, email } = await createUser(i);

			await prisma.membership.create({
				data: {
					userId: user.id,
					associationYearId: associationYear.id,
					status: MembershipStatus.PENDING,
					paymentStatus: PaymentStatus.SUCCEEDED,
					paymentAmount: associationYear.membershipFee,
					startDate: new Date(),
					endDate: associationYear.endDate
				}
			});

			createdUsers.push({ type: 'S4', email, name: `${firstName} ${lastName}` });
		}

		// 2. Create 3 users with paid membership AND card (S5 - ACTIVE)
		console.log('👥 Creazione 3 utenti in stato S5 (pagato, con tessera)...');
		for (let i = 10; i < 13; i++) {
			const { user, firstName, lastName, email } = await createUser(i);
			const membershipNumber = `DOPO-${String(i - 9).padStart(3, '0')}`;

			await prisma.membership.create({
				data: {
					userId: user.id,
					associationYearId: associationYear.id,
					membershipNumber,
					status: MembershipStatus.ACTIVE,
					paymentStatus: PaymentStatus.SUCCEEDED,
					paymentAmount: associationYear.membershipFee,
					startDate: new Date(),
					endDate: associationYear.endDate
				}
			});

			createdUsers.push({ type: 'S5', email, name: `${firstName} ${lastName}`, membershipNumber });
		}

		// 3. Create 7 users who haven't paid yet (S1 - PROFILE_COMPLETE with pending payment)
		console.log('👥 Creazione 7 utenti in stato S1 (non pagato)...');
		for (let i = 13; i < 20; i++) {
			const { user, firstName, lastName, email } = await createUser(i);

			await prisma.membership.create({
				data: {
					userId: user.id,
					associationYearId: associationYear.id,
					status: MembershipStatus.PENDING,
					paymentStatus: PaymentStatus.PENDING,
					paymentAmount: associationYear.membershipFee
				}
			});

			createdUsers.push({ type: 'S1', email, name: `${firstName} ${lastName}` });
		}

		// Summary
		console.log('\n✅ Utenti di test creati con successo!\n');
		console.log('📊 Riepilogo:');
		console.log('─'.repeat(70));

		const s4Users = createdUsers.filter(u => u.type === 'S4');
		const s5Users = createdUsers.filter(u => u.type === 'S5');
		const s1Users = createdUsers.filter(u => u.type === 'S1');

		console.log(`\n🔶 S4 - Pagato, senza tessera (${s4Users.length}):`);
		s4Users.forEach(u => console.log(`   ${u.name} <${u.email}>`));

		console.log(`\n🟢 S5 - Attivo con tessera (${s5Users.length}):`);
		s5Users.forEach(u => console.log(`   ${u.name} <${u.email}> [${u.membershipNumber}]`));

		console.log(`\n⚪ S1 - Non pagato (${s1Users.length}):`);
		s1Users.forEach(u => console.log(`   ${u.name} <${u.email}>`));

		console.log('\n' + '─'.repeat(70));
		console.log(`Totale: ${createdUsers.length} utenti`);
		console.log('\n💡 Test disponibili:');
		console.log('   - /admin/card-ranges → Gestisci range tessere');
		console.log('   - /admin/users → Assegna tessere automaticamente');

	} catch (error) {
		console.error('❌ Errore durante la creazione degli utenti:', error);
		process.exit(1);
	} finally {
		await prisma.$disconnect();
	}
}

seedTestUsers();
