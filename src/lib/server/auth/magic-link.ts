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
const MAGIC_LINK_EXPIRY_MS = 15 * 60 * 1000; // 15 minutes in milliseconds

/**
 * Generate a magic link token for authentication
 * Uses jti (JWT ID) to enable one-time use enforcement
 */
export function generateMagicLinkToken(email: string): string {
	const normalizedEmail = email.toLowerCase().trim();
	const tokenId = crypto.randomUUID(); // Unique token identifier

	return jwt.sign(
		{
			email: normalizedEmail,
			type: 'magic-link',
			jti: tokenId // JWT ID for uniqueness tracking
		},
		JWT_SECRET,
		{
			expiresIn: MAGIC_LINK_EXPIRY
		}
	);
}

/**
 * Verify a magic link token and ensure it's not been used before
 * This implements one-time use security for magic links
 */
export async function verifyMagicLinkToken(token: string): Promise<{ email: string } | null> {
	try {
		const payload = jwt.verify(token, JWT_SECRET) as {
			email: string;
			type: string;
			jti?: string;
			exp?: number;
		};

		if (payload.type !== 'magic-link') {
			return null;
		}

		// Check if token has a jti (JWT ID)
		if (!payload.jti) {
			// Old tokens without jti are rejected for security
			return null;
		}

		// Check if token has already been used
		const usedToken = await prisma.usedToken.findUnique({
			where: { tokenId: payload.jti }
		});

		if (usedToken) {
			// Token has already been used - reject it
			return null;
		}

		// Mark token as used
		const expiresAt = payload.exp
			? new Date(payload.exp * 1000)
			: new Date(Date.now() + MAGIC_LINK_EXPIRY_MS);

		await prisma.usedToken.create({
			data: {
				tokenId: payload.jti,
				tokenType: 'magic-link',
				email: payload.email,
				expiresAt
			}
		});

		return { email: payload.email };
	} catch {
		return null;
	}
}

/**
 * Generate a session token for authenticated users
 * @param userId - User or Admin ID
 * @param email - User or Admin email
 * @param role - 'user' or 'admin' (defaults to 'user' for backward compatibility)
 */
export function generateSessionToken(userId: string, email: string, role: 'user' | 'admin' = 'user'): string {
	return jwt.sign({ userId, email, role, type: 'session' }, JWT_SECRET, {
		expiresIn: SESSION_EXPIRY
	});
}

/**
 * Verify a session token
 */
export function verifySessionToken(token: string): {
	userId: string;
	email: string;
	role: 'user' | 'admin';
	issuedAt: Date;
} | null {
	try {
		const payload = jwt.verify(token, JWT_SECRET) as {
			userId: string;
			email: string;
			role?: 'user' | 'admin';
			type: string;
			iat: number; // Issued at timestamp (seconds since epoch)
		};
		if (payload.type !== 'session') {
			return null;
		}
		// Default to 'user' for backward compatibility with old tokens
		return {
			userId: payload.userId,
			email: payload.email,
			role: payload.role || 'user',
			issuedAt: new Date(payload.iat * 1000) // Convert to milliseconds
		};
	} catch {
		return null;
	}
}

/**
 * Create or update user after magic link verification
 * Users can be auto-created on first login
 */
export async function authenticateUser(email: string) {
	const normalizedEmail = email.toLowerCase().trim();

	// Find or create user
	let user = await prisma.user.findUnique({
		where: { email: normalizedEmail }
	});

	if (!user) {
		user = await prisma.user.create({
			data: { email: normalizedEmail }
		});
	}

	return user;
}

/**
 * Authenticate admin after magic link verification
 * NOTE: Admins cannot be auto-created - they must be manually added to the database first
 * This is a security feature to prevent unauthorized admin access
 */
export async function authenticateAdmin(email: string) {
	const normalizedEmail = email.toLowerCase().trim();

	// Check if admin exists (do not create if not found)
	const admin = await prisma.admin.findUnique({
		where: { email: normalizedEmail }
	});

	if (!admin) {
		throw new Error('Admin not found. Admins must be manually added to the database.');
	}

	return admin;
}

/**
 * Clean up expired used tokens
 * This should be called periodically (e.g., via cron job) to prevent database bloat
 */
export async function cleanupExpiredTokens(): Promise<number> {
	const result = await prisma.usedToken.deleteMany({
		where: {
			expiresAt: {
				lt: new Date() // Delete tokens that expired before now
			}
		}
	});

	return result.count;
}

/**
 * Invalidate all sessions for a user
 * This forces logout from all devices
 */
export async function invalidateAllUserSessions(userId: string): Promise<void> {
	await prisma.user.update({
		where: { id: userId },
		data: { sessionsInvalidatedAt: new Date() }
	});
}

/**
 * Invalidate all sessions for an admin
 * This forces logout from all devices
 */
export async function invalidateAllAdminSessions(adminId: string): Promise<void> {
	await prisma.admin.update({
		where: { id: adminId },
		data: { sessionsInvalidatedAt: new Date() }
	});
}
