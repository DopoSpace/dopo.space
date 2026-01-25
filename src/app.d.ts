// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces

import type { User, UserProfile, Membership, Admin } from '@prisma/client';
import type { SubdomainContext } from '$lib/server/utils/subdomain';
import type { locales } from '$lib/paraglide/runtime';

type Locale = (typeof locales)[number];

// PayPal SDK types
interface PayPalButtonsComponent {
	render(container: HTMLElement): void;
}

interface PayPalButtonsOptions {
	style?: {
		layout?: 'vertical' | 'horizontal';
		color?: 'gold' | 'blue' | 'silver' | 'white' | 'black';
		shape?: 'rect' | 'pill';
		label?: 'paypal' | 'checkout' | 'buynow' | 'pay';
	};
	createOrder: () => Promise<string>;
	onApprove: (data: { orderID: string }) => Promise<void>;
	onCancel?: () => void;
	onError?: (err: Error) => void;
}

interface PayPalNamespace {
	Buttons(options: PayPalButtonsOptions): PayPalButtonsComponent;
}

declare global {
	interface Window {
		paypal?: PayPalNamespace;
	}

	namespace App {
		// interface Error {}
		interface Locals {
			// Current locale for i18n
			locale: Locale;
			// Subdomain context ('admin' or 'main')
			subdomainContext: SubdomainContext;
			// Regular user (for /membership routes on main domain)
			user?: User & {
				profile: UserProfile | null;
				memberships: Membership[];
			};
			// Admin user (for /admin routes on admin subdomain)
			admin?: Admin;
		}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
