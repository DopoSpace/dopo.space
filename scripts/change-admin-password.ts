/**
 * Script per cambiare la password di un admin
 *
 * Uso: pnpm change-password -- email@example.com "nuova-password"
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function changeAdminPassword() {
	const email = process.argv[2];
	const newPassword = process.argv[3];

	if (!email || !newPassword) {
		console.error('❌ Errore: Email o password mancante');
		console.log('Uso: pnpm change-password -- email@example.com "nuova-password"');
		process.exit(1);
	}

	// Normalize email to lowercase
	const normalizedEmail = email.toLowerCase().trim();

	try {
		// Check if admin exists
		const admin = await prisma.admin.findUnique({
			where: { email: normalizedEmail }
		});

		if (!admin) {
			console.error(`❌ Admin non trovato con email: ${email}`);
			process.exit(1);
		}

		// Hash new password
		const hashedPassword = await bcrypt.hash(newPassword, 10);

		// Update password
		await prisma.admin.update({
			where: { email: normalizedEmail },
			data: { password: hashedPassword }
		});

		console.log('✅ Password aggiornata con successo!');
		console.log('📧 Email:', normalizedEmail);
		console.log('👤 Nome:', admin.name || 'N/A');
	} catch (error) {
		console.error('❌ Errore durante l\'aggiornamento della password:', error);
		process.exit(1);
	} finally {
		await prisma.$disconnect();
	}
}

changeAdminPassword();
