/**
 * Membership-related types and enums
 */

import type { MembershipStatus, PaymentStatus } from '@prisma/client';

// Re-export Prisma enums for convenience (type-only)
export type { MembershipStatus, PaymentStatus };

/**
 * User system states as defined in PRD
 */
export enum SystemState {
	S0_NO_MEMBERSHIP = 'S0_NO_MEMBERSHIP', // Registered but no membership (interrotto)
	S1_PROFILE_COMPLETE = 'S1_PROFILE_COMPLETE', // Profile complete, payment pending (in attesa di pagamento)
	S2_PROCESSING_PAYMENT = 'S2_PROCESSING_PAYMENT', // Payment in progress (in attesa di pagamento)
	S3_PAYMENT_FAILED = 'S3_PAYMENT_FAILED', // Payment failed (pagamento fallito)
	S4_AWAITING_NUMBER = 'S4_AWAITING_NUMBER', // Payment succeeded, awaiting number assignment (pagato)
	S5_ACTIVE = 'S5_ACTIVE', // Number assigned, active membership (attivo)
	S6_EXPIRED = 'S6_EXPIRED', // Membership expired (scaduto)
	S7_CANCELED = 'S7_CANCELED' // Admin canceled the membership (cancellato)
}

/**
 * Italian labels for system states
 */
export const SystemStateLabels: Record<SystemState, string> = {
	[SystemState.S0_NO_MEMBERSHIP]: 'Interrotto',
	[SystemState.S1_PROFILE_COMPLETE]: 'In attesa di pagamento',
	[SystemState.S2_PROCESSING_PAYMENT]: 'In attesa di pagamento',
	[SystemState.S3_PAYMENT_FAILED]: 'Pagamento fallito',
	[SystemState.S4_AWAITING_NUMBER]: 'Pagato',
	[SystemState.S5_ACTIVE]: 'Attivo',
	[SystemState.S6_EXPIRED]: 'Scaduto',
	[SystemState.S7_CANCELED]: 'Cancellato'
};

/**
 * Membership summary for user display
 */
export interface MembershipSummary {
	systemState: SystemState;
	italianLabel: string;
	hasActiveMembership: boolean;
	membershipNumber: string | null;
	previousMembershipNumber: string | null;
	startDate: Date | null;
	endDate: Date | null;
	profileComplete: boolean;
	canPurchase: boolean;
	message: string;
}

/**
 * User profile data
 * Note: Some fields are nullable until user completes full profile
 */
export interface UserProfileData {
	firstName: string;
	lastName: string;
	birthDate?: Date | null;
	taxCode?: string | null;
	address?: string | null;
	city?: string | null;
	postalCode?: string | null;
	province?: string | null;
	documentType?: string | null;
	documentNumber?: string | null;
	privacyConsent?: boolean | null;
	dataConsent?: boolean | null;
}
