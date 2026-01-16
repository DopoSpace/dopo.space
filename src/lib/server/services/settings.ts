import { prisma } from '$lib/server/db/prisma';

// Setting keys
export const SETTING_KEYS = {
	MEMBERSHIP_FEE: 'MEMBERSHIP_FEE'
} as const;

// Default values (in cents for monetary values)
const DEFAULTS: Record<string, string> = {
	[SETTING_KEYS.MEMBERSHIP_FEE]: '2500' // €25.00
};

/**
 * Get a setting value by key
 */
export async function getSetting(key: string): Promise<string | null> {
	const setting = await prisma.settings.findUnique({
		where: { key }
	});

	return setting?.value ?? DEFAULTS[key] ?? null;
}

/**
 * Set a setting value
 */
export async function setSetting(key: string, value: string): Promise<void> {
	await prisma.settings.upsert({
		where: { key },
		update: { value },
		create: { key, value }
	});
}

/**
 * Get the current membership fee in cents
 */
export async function getMembershipFee(): Promise<number> {
	const value = await getSetting(SETTING_KEYS.MEMBERSHIP_FEE);
	const fee = parseInt(value ?? DEFAULTS[SETTING_KEYS.MEMBERSHIP_FEE], 10);

	if (isNaN(fee) || fee <= 0) {
		throw new Error('Invalid membership fee configuration');
	}

	return fee;
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
