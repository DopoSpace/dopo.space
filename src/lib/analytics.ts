import { browser } from '$app/environment';

declare global {
	interface Window {
		gtag: (...args: unknown[]) => void;
		dataLayer: unknown[];
	}
}

// Get GA Measurement ID from environment (may be undefined if not configured)
const GA_MEASUREMENT_ID = import.meta.env.PUBLIC_GA_MEASUREMENT_ID as string | undefined;

let initialized = false;
let consentGiven = false;

/**
 * Set analytics consent status
 * Call this when user gives/revokes consent
 * @param allowed - Whether analytics is allowed
 */
export function setAnalyticsConsent(allowed: boolean): void {
	consentGiven = allowed;
	if (allowed && browser && !initialized) {
		initGA();
	}
}

/**
 * Initialize Google Analytics 4
 * Should be called once on app mount
 * If PUBLIC_GA_MEASUREMENT_ID is not configured, GA4 is disabled
 * Requires consent to be given first
 */
export function initGA(): void {
	if (!browser || !GA_MEASUREMENT_ID || initialized) return;

	// Don't initialize without consent
	if (!consentGiven) return;

	// Don't track admin pages
	if (window.location.pathname.startsWith('/admin')) return;

	// Load gtag.js
	const script = document.createElement('script');
	script.async = true;
	script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
	document.head.appendChild(script);

	// Initialize dataLayer
	window.dataLayer = window.dataLayer || [];
	window.gtag = function gtag(...args: unknown[]) {
		window.dataLayer.push(args);
	};
	window.gtag('js', new Date());
	window.gtag('config', GA_MEASUREMENT_ID, {
		send_page_view: false, // We'll track page views manually for SPA navigation
		anonymize_ip: true // GDPR compliance
	});

	initialized = true;
}

/**
 * Track page view
 * @param path - The page path to track
 */
export function trackPageView(path: string): void {
	if (!browser || !window.gtag || path.startsWith('/admin')) return;

	window.gtag('event', 'page_view', {
		page_path: path
	});
}

/**
 * Track custom event
 * @param eventName - The event name (e.g., 'login_start', 'payment_success')
 * @param params - Optional event parameters
 */
export function trackEvent(
	eventName: string,
	params?: Record<string, string | number | boolean>
): void {
	if (!browser || !window.gtag) return;

	// Don't track events on admin pages
	if (window.location.pathname.startsWith('/admin')) return;

	window.gtag('event', eventName, params);
}

// ============================================
// Authentication Events
// ============================================

export function trackLoginStart(): void {
	trackEvent('login_start', { method: 'magic_link' });
}

export function trackLoginSuccess(): void {
	trackEvent('login_success', { method: 'magic_link' });
}

export function trackLoginFailure(reason: 'expired' | 'invalid' | 'unknown'): void {
	trackEvent('login_failure', { method: 'magic_link', reason });
}

export function trackLogout(): void {
	trackEvent('logout');
}

// ============================================
// Membership Funnel Events
// ============================================

export function trackProfileFormStart(): void {
	trackEvent('profile_form_start');
}

export function trackProfileFormSubmit(success: boolean): void {
	trackEvent('profile_form_submit', { success });
}

export function trackCheckoutView(amountCents: number): void {
	trackEvent('checkout_view', {
		value: amountCents / 100,
		currency: 'EUR'
	});
}

export function trackPaymentStart(amountCents: number): void {
	trackEvent('payment_start', {
		value: amountCents / 100,
		currency: 'EUR'
	});
}

export function trackPaymentSuccess(amountCents: number, transactionId?: string): void {
	trackEvent('payment_success', {
		value: amountCents / 100,
		currency: 'EUR',
		...(transactionId && { transaction_id: transactionId })
	});
}

export function trackPaymentCancel(): void {
	trackEvent('payment_cancel');
}

// ============================================
// UI Interaction Events
// ============================================

export function trackLanguageSwitch(from: string, to: string): void {
	trackEvent('language_switch', { from, to });
}

export function trackExternalLinkClick(url: string, label?: string): void {
	trackEvent('external_link_click', {
		url,
		...(label && { label })
	});
}

export function trackContactClick(type: 'email' | 'instagram' | 'maps'): void {
	trackEvent('contact_click', { type });
}
