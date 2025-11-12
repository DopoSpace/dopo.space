/**
 * Magic Link Authentication
 *
 * Handles passwordless authentication via email magic links.
 */

import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '$env/static/private';
import { prisma } from '../db/prisma';
import crypto from 'crypto';

const MAGIC_LINK_EXPIRY = '15m'; // 15 minutes
const SESSION_EXPIRY = '7d'; // 7 days

/**
 * Generate a magic link token for authentication
 */
export function generateMagicLinkToken(email: string): string {
	return jwt.sign({ email, type: 'magic-link' }, JWT_SECRET, {
		expiresIn: MAGIC_LINK_EXPIRY
	});
}

/**
 * Verify a magic link token
 */
export function verifyMagicLinkToken(token: string): { email: string } | null {
	try {
		const payload = jwt.verify(token, JWT_SECRET) as { email: string; type: string };
		if (payload.type !== 'magic-link') {
			return null;
		}
		return { email: payload.email };
	} catch {
		return null;
	}
}

/**
 * Generate a session token for authenticated users
 */
export function generateSessionToken(userId: string, email: string): string {
	return jwt.sign({ userId, email, type: 'session' }, JWT_SECRET, {
		expiresIn: SESSION_EXPIRY
	});
}

/**
 * Verify a session token
 */
export function verifySessionToken(token: string): { userId: string; email: string } | null {
	try {
		const payload = jwt.verify(token, JWT_SECRET) as {
			userId: string;
			email: string;
			type: string;
		};
		if (payload.type !== 'session') {
			return null;
		}
		return { userId: payload.userId, email: payload.email };
	} catch {
		return null;
	}
}

/**
 * Helper function to generate and update auth token for an entity
 * This avoids code duplication for token generation (DRY)
 */
function generateAuthToken(): string {
	return crypto.randomBytes(32).toString('hex');
}

/**
 * Create or update user after magic link verification
 * Users can be auto-created on first login
 */
export async function authenticateUser(email: string) {
	// Find or create user
	let user = await prisma.user.findUnique({
		where: { email }
	});

	if (!user) {
		user = await prisma.user.create({
			data: { email }
		});
	}

	// Update with new auth token
	const authToken = generateAuthToken();
	await prisma.user.update({
		where: { id: user.id },
		data: { authToken }
	});

	return user;
}

/**
 * Authenticate admin after magic link verification
 * NOTE: Admins cannot be auto-created - they must be manually added to the database first
 * This is a security feature to prevent unauthorized admin access
 */
export async function authenticateAdmin(email: string) {
	// Check if admin exists (do not create if not found)
	const admin = await prisma.admin.findUnique({
		where: { email }
	});

	if (!admin) {
		throw new Error('Admin not found. Admins must be manually added to the database.');
	}

	// Update with new auth token
	const authToken = generateAuthToken();
	await prisma.admin.update({
		where: { id: admin.id },
		data: { authToken }
	});

	return admin;
}
