<script lang="ts">
	import { page } from '$app/stores';
	import { trackLanguageSwitch } from '$lib/analytics';

	// Get current locale from page data (set by hooks.server.ts)
	const currentLocale = $derived($page?.data?.locale || 'it');

	// Get the current path without any locale prefix (with defensive checks)
	const basePath = $derived.by(() => {
		const pathname = $page?.url?.pathname ?? '/';
		// Strip /en prefix if present
		if (pathname.startsWith('/en/')) {
			return pathname.slice(3);
		}
		// Check for /en (length 3)
		if (pathname.length === 3 && pathname.startsWith('/en')) {
			return '/';
		}
		return pathname;
	});

	// Create localized href
	function getLocalizedHref(locale: string): string {
		const path = basePath;
		if (locale === 'en') {
			// English: add /en prefix
			return path === '/' ? '/en' : `/en${path}`;
		}
		// Italian (default): no prefix
		return path;
	}

	// Handle language switch with error handling
	function handleClick(event: MouseEvent, locale: string) {
		event.preventDefault();

		// Track language switch (wrapped in try-catch to prevent blocking navigation)
		try {
			trackLanguageSwitch(currentLocale, locale);
		} catch {
			// Analytics failure should not block language switch
			console.warn('Failed to track language switch');
		}

		// Set cookie for locale preference (wrapped in try-catch)
		// Cookie name must match Paraglide's cookieName in runtime.js
		try {
			document.cookie = `PARAGLIDE_LOCALE=${locale}; path=/; max-age=31536000; SameSite=Lax`;
		} catch {
			// Cookie setting failure should not block navigation
			console.warn('Failed to set locale cookie');
		}

		// Navigate to the localized URL
		try {
			window.location.href = getLocalizedHref(locale);
		} catch (error) {
			// If navigation fails, try a fallback approach
			console.error('Navigation failed:', error);
			window.location.reload();
		}
	}

	// Language display names
	const localeNames: Record<string, string> = {
		it: 'IT',
		en: 'EN'
	};

	const locales = ['it', 'en'] as const;
</script>

<div class="language-switcher">
	{#each locales as locale}
		{@const isActive = locale === currentLocale}
		{@const href = getLocalizedHref(locale)}
		<a
			{href}
			class="locale-link"
			class:active={isActive}
			aria-current={isActive ? 'page' : undefined}
			onclick={(e) => handleClick(e, locale)}
		>
			{localeNames[locale] || locale.toUpperCase()}
		</a>
		{#if locale !== locales[locales.length - 1]}
			<span class="separator">|</span>
		{/if}
	{/each}
</div>

<style>
	@reference "tailwindcss";

	.language-switcher {
		@apply flex items-center gap-1 text-sm;
	}

	.locale-link {
		@apply text-white/70 hover:text-white transition-colors px-1;
	}

	.locale-link.active {
		@apply text-white font-bold;
	}

	.separator {
		@apply text-white/40;
	}
</style>
