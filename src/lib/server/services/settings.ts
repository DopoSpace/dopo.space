import { prisma } from '$lib/server/db/prisma';
import { createLogger } from '$lib/server/utils/logger';

const logger = createLogger({ module: 'settings' });

// Setting keys
export const SETTING_KEYS = {
	MEMBERSHIP_FEE: 'MEMBERSHIP_FEE'
} as const;

// Type for valid setting keys
type SettingKey = (typeof SETTING_KEYS)[keyof typeof SETTING_KEYS];

// Default values (in cents for monetary values)
const DEFAULTS: Record<SettingKey, string> = {
	[SETTING_KEYS.MEMBERSHIP_FEE]: '2500' // €25.00
};

// Known valid keys for warning detection
const KNOWN_KEYS = new Set(Object.values(SETTING_KEYS));

/**
 * Get a setting value by key
 * @param key - The setting key to retrieve
 * @returns The setting value or null if not found and no default exists
 */
export async function getSetting(key: string): Promise<string | null> {
	// Warn if using an unknown key (potential typo or misconfiguration)
	if (!KNOWN_KEYS.has(key as SettingKey)) {
		logger.warn(
			{ key, knownKeys: Array.from(KNOWN_KEYS) },
			'Attempting to get unknown setting key - possible typo or misconfiguration'
		);
	}

	const setting = await prisma.settings.findUnique({
		where: { key }
	});

	return setting?.value ?? (DEFAULTS as Record<string, string>)[key] ?? null;
}

/**
 * Set a setting value
 */
export async function setSetting(key: string, value: string): Promise<void> {
	// Warn if setting an unknown key
	if (!KNOWN_KEYS.has(key as SettingKey)) {
		logger.warn(
			{ key, knownKeys: Array.from(KNOWN_KEYS) },
			'Setting unknown setting key - possible typo or misconfiguration'
		);
	}

	await prisma.settings.upsert({
		where: { key },
		update: { value },
		create: { key, value }
	});

	// Invalidate cache when setting is updated
	if (key === SETTING_KEYS.MEMBERSHIP_FEE) {
		membershipFeeCache = null;
	}
}

// Cache for membership fee (rarely changes, frequently accessed)
let membershipFeeCache: { value: number; expiresAt: number } | null = null;
const MEMBERSHIP_FEE_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Get the current membership fee in cents
 * Uses in-memory cache to reduce database queries (fee rarely changes)
 */
export async function getMembershipFee(): Promise<number> {
	const now = Date.now();

	// Return cached value if valid
	if (membershipFeeCache && membershipFeeCache.expiresAt > now) {
		return membershipFeeCache.value;
	}

	const value = await getSetting(SETTING_KEYS.MEMBERSHIP_FEE);
	const fee = parseInt(value ?? DEFAULTS[SETTING_KEYS.MEMBERSHIP_FEE], 10);

	if (isNaN(fee) || fee <= 0) {
		throw new Error('Invalid membership fee configuration');
	}

	// Cache the result
	membershipFeeCache = {
		value: fee,
		expiresAt: now + MEMBERSHIP_FEE_CACHE_TTL
	};

	return fee;
}

/**
 * Clear the membership fee cache (useful for testing)
 */
export function clearMembershipFeeCache(): void {
	membershipFeeCache = null;
}

/**
 * Set the membership fee (in cents)
 */
export async function setMembershipFee(feeInCents: number): Promise<void> {
	if (feeInCents <= 0) {
		throw new Error('Membership fee must be greater than 0');
	}

	await setSetting(SETTING_KEYS.MEMBERSHIP_FEE, feeInCents.toString());
}

/**
 * Get all settings as an object
 */
export async function getAllSettings(): Promise<Record<string, string>> {
	const settings = await prisma.settings.findMany();
	const result: Record<string, string> = { ...DEFAULTS };

	for (const setting of settings) {
		result[setting.key] = setting.value;
	}

	return result;
}

/**
 * Initialize default settings if they don't exist
 */
export async function initializeSettings(): Promise<void> {
	for (const [key, value] of Object.entries(DEFAULTS)) {
		const existing = await prisma.settings.findUnique({ where: { key } });
		if (!existing) {
			await prisma.settings.create({ data: { key, value } });
		}
	}
}
