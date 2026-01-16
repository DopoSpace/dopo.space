// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces

import type { User, UserProfile, Membership, Admin } from '@prisma/client';
import type { SubdomainContext } from '$lib/server/utils/subdomain';

declare global {
	namespace App {
		// interface Error {}
		interface Locals {
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
