/**
 * SvelteKit Universal Hooks
 *
 * The reroute hook handles URL rewriting for i18n locale prefixes.
 * This runs before route matching, allowing /en/... URLs to be
 * handled by the same routes as /...
 */

/**
 * Reroute hook for i18n URL handling
 * Strips /en/ prefix so routes are matched correctly
 * @type {import('@sveltejs/kit').Reroute}
 */
export const reroute = ({ url }) => {
	const pathname = url.pathname;

	// Check if URL has English locale prefix using regex
	// This avoids TypeScript's strict route type checking
	if (/^\/en(\/|$)/.test(pathname)) {
		// Check length to determine if it's just /en (length 3) or /en/ (length 4 with no more path)
		if (pathname.length <= 4) {
			// /en or /en/ -> /
			return '/';
		}
		// Strip /en prefix - e.g., /en/auth/login -> /auth/login
		return pathname.slice(3);
	}

	// No rewriting needed for Italian (default) routes
	return pathname;
};
