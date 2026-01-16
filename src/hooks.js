/**
 * SvelteKit Universal Hooks
 *
 * The reroute hook runs before handle and can change URL routing
 */

/** @type {import('@sveltejs/kit').Reroute} */
export const reroute = ({ url }) => {
	const hostname = url.hostname.split(':')[0]; // Remove port
	const pathname = url.pathname;

	// Check if on admin subdomain (admin.*)
	const isAdminSubdomain = hostname.startsWith('admin.');

	if (isAdminSubdomain) {
		// Don't reroute paths that already have /admin or are API webhook paths
		if (!pathname.startsWith('/admin') && !pathname.startsWith('/api/webhooks')) {
			// Reroute to /admin prefix
			return '/admin' + pathname;
		}
	}

	return pathname;
};
