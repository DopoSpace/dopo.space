/**
 * Magic Link Authentication
 *
 * Handles passwordless authentication via email magic links.
 */

import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '$env/static/private';
import { prisma } from '../db/prisma';
import crypto from 'crypto';
import pino from 'pino';

const logger = pino({ name: 'magic-link' });

// Keep in sync with MAGIC_LINK_EXPIRY_MINUTES in config/constants.ts
const MAGIC_LINK_EXPIRY = '30m';
const MAGIC_LINK_EXPIRY_MS = 30 * 60 * 1000;
const SESSION_EXPIRY = '7d';

interface MagicLinkPayload {
	email: string;
	type: string;
	jti?: string;
	exp?: number;
}

/**
 * Decode and validate a magic link JWT.
 * Returns the payload if the token is a valid, unexpired magic link with a jti.
 * Returns null otherwise.
 */
function decodeMagicLinkPayload(token: string): MagicLinkPayload | null {
	try {
		const payload = jwt.verify(token, JWT_SECRET) as MagicLinkPayload;

		if (payload.type !== 'magic-link' || !payload.jti) {
			return null;
		}

		return payload;
	} catch {
		return null;
	}
}

/**
 * Generate a magic link token for authentication.
 * Uses jti (JWT ID) to enable one-time use enforcement.
 */
export function generateMagicLinkToken(email: string): string {
	const normalizedEmail = email.toLowerCase().trim();

	return jwt.sign(
		{
			email: normalizedEmail,
			type: 'magic-link',
			jti: crypto.randomUUID()
		},
		JWT_SECRET,
		{ expiresIn: MAGIC_LINK_EXPIRY }
	);
}

/**
 * Peek at a magic link token to check validity without consuming it.
 * Used by the verify page GET to show the confirmation form.
 * Does NOT mark the token as used.
 */
export function peekMagicLinkToken(token: string): { email: string } | null {
	const payload = decodeMagicLinkPayload(token);
	if (!payload) return null;
	return { email: payload.email };
}

/**
 * Verify a magic link token and ensure it has not been used before.
 * Marks the token as consumed on success (one-time use).
 */
export async function verifyMagicLinkToken(token: string): Promise<{ email: string } | null> {
	const payload = decodeMagicLinkPayload(token);

	if (!payload) {
		logger.debug({ tokenLength: token?.length }, 'Magic link token verification failed');
		return null;
	}

	const alreadyUsed = await prisma.usedToken.findUnique({
		where: { tokenId: payload.jti! }
	});

	if (alreadyUsed) {
		return null;
	}

	const expiresAt = payload.exp
		? new Date(payload.exp * 1000)
		: new Date(Date.now() + MAGIC_LINK_EXPIRY_MS);

	await prisma.usedToken.create({
		data: {
			tokenId: payload.jti!,
			tokenType: 'magic-link',
			email: payload.email,
			expiresAt
		}
	});

	return { email: payload.email };
}

/**
 * Generate a session token for authenticated users
 * @param userId - User or Admin ID
 * @param email - User or Admin email
 * @param role - 'user' or 'admin' (defaults to 'user' for backward compatibility)
 */
export function generateSessionToken(userId: string, email: string, role: 'user' | 'admin' = 'user'): string {
	// Explicitly include iat for consistency and session invalidation checks
	const issuedAt = Math.floor(Date.now() / 1000);
	return jwt.sign({ userId, email, role, type: 'session', iat: issuedAt }, JWT_SECRET, {
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
	} catch (error) {
		// Log at debug level to avoid flooding logs while preserving context for debugging
		logger.debug({
			errorType: error instanceof Error ? error.name : 'Unknown',
			message: error instanceof Error ? error.message : String(error),
			tokenLength: token?.length
		}, 'Session token verification failed');
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
