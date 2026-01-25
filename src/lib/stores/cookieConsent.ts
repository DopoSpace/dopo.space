import { writable } from 'svelte/store';
import { browser } from '$app/environment';

const STORAGE_KEY = 'cookie_consent';
const CONSENT_VERSION = '1.0';

export interface CookieConsent {
	necessary: boolean;
	analytics: boolean;
	timestamp: number;
	version: string;
}

interface CookieConsentState {
	consent: CookieConsent | null;
	showBanner: boolean;
}

function createCookieConsentStore() {
	const { subscribe, set, update } = writable<CookieConsentState>({
		consent: null,
		showBanner: false
	});

	function saveConsent(consent: CookieConsent): void {
		if (browser) {
			try {
				localStorage.setItem(STORAGE_KEY, JSON.stringify(consent));
			} catch {
				// localStorage not available (private browsing)
			}
		}
		set({ consent, showBanner: false });
	}

	return {
		subscribe,

		init(): void {
			if (!browser) return;

			const stored = localStorage.getItem(STORAGE_KEY);
			if (stored) {
				try {
					const consent = JSON.parse(stored) as CookieConsent;
					if (consent.version === CONSENT_VERSION) {
						set({ consent, showBanner: false });
						return;
					}
				} catch {
					// Invalid JSON, show banner
				}
			}
			set({ consent: null, showBanner: true });
		},

		acceptAll(): void {
			saveConsent({
				necessary: true,
				analytics: true,
				timestamp: Date.now(),
				version: CONSENT_VERSION
			});
		},

		acceptNecessaryOnly(): void {
			saveConsent({
				necessary: true,
				analytics: false,
				timestamp: Date.now(),
				version: CONSENT_VERSION
			});
		},

		reopenBanner(): void {
			update((state) => ({ ...state, showBanner: true }));
		}
	};
}

export const cookieConsent = createCookieConsentStore();
