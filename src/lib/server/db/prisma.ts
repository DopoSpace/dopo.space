/**
 * Prisma Client Singleton
 *
 * This file exports a single Prisma Client instance to be reused across the application.
 * In development, it prevents multiple instances from being created during hot reloads.
 */

import { PrismaClient } from '@prisma/client';
import { dev } from '$app/environment';

// Declare global type for development
declare global {
	// eslint-disable-next-line no-var
	var __prisma: PrismaClient | undefined;
}

// Create a single instance
export const prisma = global.__prisma || new PrismaClient({
	log: dev ? ['query', 'error', 'warn'] : ['error']
});

// In development, store the instance globally to prevent multiple instances
if (dev) {
	global.__prisma = prisma;
}
