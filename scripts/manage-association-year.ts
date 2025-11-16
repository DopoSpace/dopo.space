/**
 * Association Year Management Script
 *
 * Handles creation, activation, and deactivation of association years
 * Usage:
 *   npm run manage-year create <start-date> <end-date> <fee>
 *   npm run manage-year activate <year-id>
 *   npm run manage-year list
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function createYear(startDate: string, endDate: string, fee: number) {
	const year = await prisma.associationYear.create({
		data: {
			startDate: new Date(startDate),
			endDate: new Date(endDate),
			membershipFee: Math.round(fee * 100), // Convert euros to cents
			isActive: false
		}
	});

	console.log('✅ Association year created:');
	console.log(`   ID: ${year.id}`);
	console.log(`   Period: ${year.startDate.toISOString()} to ${year.endDate.toISOString()}`);
	console.log(`   Fee: €${(year.membershipFee / 100).toFixed(2)}`);
	console.log(`   Active: ${year.isActive}`);
}

async function activateYear(yearId: string) {
	// Deactivate all other years
	await prisma.associationYear.updateMany({
		where: { isActive: true },
		data: { isActive: false }
	});

	// Activate the specified year
	const year = await prisma.associationYear.update({
		where: { id: yearId },
		data: { isActive: true }
	});

	console.log('✅ Association year activated:');
	console.log(`   ID: ${year.id}`);
	console.log(`   Period: ${year.startDate.toISOString()} to ${year.endDate.toISOString()}`);
}

async function listYears() {
	const years = await prisma.associationYear.findMany({
		orderBy: { startDate: 'desc' }
	});

	console.log(`📋 Association Years (${years.length} total):\n`);

	for (const year of years) {
		const status = year.isActive ? '🟢 ACTIVE' : '⚪ Inactive';
		console.log(`${status} ${year.id}`);
		console.log(`   Period: ${year.startDate.toISOString().split('T')[0]} to ${year.endDate.toISOString().split('T')[0]}`);
		console.log(`   Fee: €${(year.membershipFee / 100).toFixed(2)}`);
		console.log('');
	}
}

async function seedInitialYears() {
	// Create 2025 year
	const year2025 = await prisma.associationYear.create({
		data: {
			startDate: new Date('2025-01-01'),
			endDate: new Date('2025-12-31'),
			membershipFee: 2500, // €25.00
			isActive: true
		}
	});

	console.log('✅ Initial association year created and activated:');
	console.log(`   2025: €${(year2025.membershipFee / 100).toFixed(2)}`);
}

async function main() {
	const command = process.argv[2];

	try {
		switch (command) {
			case 'create':
				const startDate = process.argv[3];
				const endDate = process.argv[4];
				const fee = parseFloat(process.argv[5]);

				if (!startDate || !endDate || isNaN(fee)) {
					console.error('❌ Usage: npm run manage-year create <start-date> <end-date> <fee>');
					console.error('   Example: npm run manage-year create 2026-01-01 2026-12-31 25');
					process.exit(1);
				}

				await createYear(startDate, endDate, fee);
				break;

			case 'activate':
				const yearId = process.argv[3];

				if (!yearId) {
					console.error('❌ Usage: npm run manage-year activate <year-id>');
					process.exit(1);
				}

				await activateYear(yearId);
				break;

			case 'list':
				await listYears();
				break;

			case 'seed':
				await seedInitialYears();
				break;

			default:
				console.log('📖 Association Year Management');
				console.log('');
				console.log('Commands:');
				console.log('  npm run manage-year create <start-date> <end-date> <fee>');
				console.log('  npm run manage-year activate <year-id>');
				console.log('  npm run manage-year list');
				console.log('  npm run manage-year seed  (create initial 2025 year)');
				break;
		}
	} catch (error) {
		console.error('❌ Error:', error);
		process.exit(1);
	} finally {
		await prisma.$disconnect();
	}
}

main();
