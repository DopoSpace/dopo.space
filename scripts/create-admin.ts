/**
 * Script per creare un admin nel database
 *
 * Uso: npm run create-admin -- email@example.com "password" "Nome Admin"
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function createAdmin() {
	const email = process.argv[2];
	const password = process.argv[3];
	const name = process.argv[4] || null;

	if (!email || !password) {
		console.error('❌ Errore: Email o password mancante');
		console.log('Uso: npm run create-admin -- email@example.com "password" "Nome Admin"');
		process.exit(1);
	}

	try {
		// Check if admin already exists
		const existing = await prisma.admin.findUnique({
			where: { email }
		});

		if (existing) {
			console.log(`⚠️  Admin già esistente con email: ${email}`);
			process.exit(0);
		}

		// Hash password
		const hashedPassword = await bcrypt.hash(password, 10);

		// Create admin
		const admin = await prisma.admin.create({
			data: {
				email,
				name,
				password: hashedPassword
			}
		});

		console.log('✅ Admin creato con successo!');
		console.log('📧 Email:', admin.email);
		console.log('👤 Nome:', admin.name || 'N/A');
		console.log('🆔 ID:', admin.id);
		console.log('\n🔐 Ora puoi accedere a /admin/login con questa email e password');
	} catch (error) {
		console.error('❌ Errore durante la creazione dell\'admin:', error);
		process.exit(1);
	} finally {
		await prisma.$disconnect();
	}
}

createAdmin();
