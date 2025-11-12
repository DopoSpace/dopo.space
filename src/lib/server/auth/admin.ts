/**
 * Admin Utilities
 *
 * Helper functions for admin-related queries.
 * Authentication logic is handled in magic-link.ts to avoid duplication.
 */

import { prisma } from '../db/prisma';

/**
 * Check if an email belongs to an admin and return the admin if found
 * This combines isAdmin + getAdminByEmail to avoid duplicate queries (DRY)
 */
export async function findAdminByEmail(email: string) {
	return await prisma.admin.findUnique({
		where: { email }
	});
}

/**
 * Get admin by ID
 */
export async function findAdminById(id: string) {
	return await prisma.admin.findUnique({
		where: { id }
	});
}
