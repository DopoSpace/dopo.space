// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces

import type { User, UserProfile, Membership, Admin } from '@prisma/client';

declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			// Regular user (for /membership routes)
			user?: User & {
				profile: UserProfile | null;
				memberships: Membership[];
			};
			// Admin user (for /admin routes)
			admin?: Admin;
		}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
