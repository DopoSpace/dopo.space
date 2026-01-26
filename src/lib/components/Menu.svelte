<script lang="ts">
	import MenuItem from './MenuItem.svelte';
	import LanguageSwitcher from './LanguageSwitcher.svelte';
	import { navigationItems } from '$lib/config/navigation';
	import { page } from '$app/stores';
	import { localizeHref } from '$lib/paraglide/runtime';
	import * as m from '$lib/paraglide/messages';

	interface Props {
		user?: { id: string; email: string } | null;
		admin?: { id: string; email: string } | null;
	}

	let { user = null, admin = null }: Props = $props();

	// Mobile menu state
	let menuOpen = $state(false);

	// Navigation label lookup - maps labelKey to translated string
	const navLabels: Record<string, () => string> = {
		home: m.nav_home,
		about: m.nav_about,
		contact: m.nav_contact,
		membership: m.nav_membership
	};

	/**
	 * Get navigation label with fallback to key
	 */
	function getNavLabel(labelKey: string): string {
		const labelFn = navLabels[labelKey];
		return labelFn ? labelFn() : labelKey;
	}

	/**
	 * Safely call a message function with fallback
	 */
	function safeMessage(fn: () => string, fallback: string): string {
		try {
			return fn();
		} catch {
			return fallback;
		}
	}

	// Get current path without locale prefix for comparisons (with defensive checks)
	const currentBasePath = $derived.by(() => {
		const pathname = ($page?.url?.pathname ?? '/') as string;
		if (pathname.startsWith('/en/')) return pathname.slice(3);
		if (pathname === '/en') return '/';
		return pathname;
	});

	// Hide "Login" if we're already on the login page
	const isLoginPage = $derived(currentBasePath === '/auth/login' || currentBasePath === '/admin/login');

	// Determine logout action based on user type (logout doesn't need localization)
	const logoutAction = $derived(admin ? '/admin/logout' : '/auth/logout');
	const isAuthenticated = $derived(!!user || !!admin);

	// Don't show language switcher on admin pages
	const isAdminPage = $derived(currentBasePath.startsWith('/admin'));

	// Filter navigationItems for authenticated users: exclude membership CTA (filter by path, not label)
	const filteredNavigationItems = $derived(
		isAuthenticated
			? navigationItems.filter(item => item.to !== '/auth/login')
			: navigationItems
	);

	function toggleMenu() {
		menuOpen = !menuOpen;
	}

	function closeMenu() {
		menuOpen = false;
	}

	/**
	 * Handle Escape key to close mobile menu
	 */
	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape' && menuOpen) {
			closeMenu();
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<nav class="menu">
	<div class="menu-container">
		<!-- Mobile hamburger button -->
		<button
			type="button"
			class="hamburger md:hidden"
			onclick={toggleMenu}
			aria-label={menuOpen ? 'Close menu' : 'Open menu'}
			aria-expanded={menuOpen}
			aria-controls="mobile-menu"
		>
			{#if menuOpen}
				<!-- Close icon -->
				<svg class="hamburger-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
					<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
				</svg>
			{:else}
				<!-- Hamburger icon -->
				<svg class="hamburger-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
					<path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h16" />
				</svg>
			{/if}
		</button>

		<!-- Desktop navigation -->
		<div class="desktop-nav hidden md:flex items-center gap-4">
			{#each filteredNavigationItems as { to, labelKey }}
				<MenuItem {to} item={getNavLabel(labelKey)} />
			{/each}
			{#if user}
				<MenuItem to="/membership/subscription" item={safeMessage(m.common_my_profile, 'My Profile')} />
			{/if}
		</div>

		<!-- Right side items (always visible) -->
		<div class="menu-right">
			{#if !isAdminPage}
				<LanguageSwitcher />
			{/if}
			<!-- Desktop only: auth buttons -->
			<div class="hidden md:flex items-center gap-4">
				{#if isAuthenticated}
					<form method="POST" action={logoutAction}>
						<button type="submit" class="auth-button">
							{safeMessage(m.common_logout, 'Logout')}
						</button>
					</form>
				{:else if !isLoginPage}
					<MenuItem to="/auth/login" item={safeMessage(m.common_login, 'Login')} />
				{/if}
			</div>
		</div>
	</div>

	<!-- Mobile menu overlay -->
	{#if menuOpen}
		<div
			class="mobile-overlay md:hidden"
			onclick={closeMenu}
			onkeydown={(e) => e.key === 'Enter' && closeMenu()}
			role="button"
			tabindex="0"
			aria-label="Close menu"
		></div>
		<div class="mobile-menu md:hidden" id="mobile-menu" role="menu">
			<div class="mobile-nav">
				{#each filteredNavigationItems as { to, labelKey }}
					<a href={localizeHref(to)} class="mobile-link" onclick={closeMenu} role="menuitem">
						{getNavLabel(labelKey)}
					</a>
				{/each}
				{#if user}
					<a href={localizeHref('/membership/subscription')} class="mobile-link" onclick={closeMenu} role="menuitem">
						{safeMessage(m.common_my_profile, 'My Profile')}
					</a>
				{/if}
			</div>
			<div class="mobile-auth">
				{#if isAuthenticated}
					<form method="POST" action={logoutAction}>
						<button type="submit" class="mobile-auth-button">
							{safeMessage(m.common_logout, 'Logout')}
						</button>
					</form>
				{:else if !isLoginPage}
					<a href={localizeHref('/auth/login')} class="mobile-auth-button" onclick={closeMenu} role="menuitem">
						{safeMessage(m.common_login, 'Login')}
					</a>
				{/if}
			</div>
		</div>
	{/if}
</nav>

<style>
	@reference "../../app.css";

	/* Menu bar - positioned at top of viewport */
	.menu {
		@apply absolute top-0 left-0 w-full z-50;
	}

	/*
	 * Menu container needs explicit background and stacking context
	 * to stay above the mobile overlay (z-index: 40)
	 */
	.menu-container {
		@apply flex justify-between items-center gap-4 px-4 py-2 relative z-50;
		background-color: var(--color-dopoRed);
	}

	.hamburger {
		@apply p-2 -ml-2 text-white;
	}

	.hamburger-icon {
		@apply w-6 h-6;
	}

	.menu-right {
		@apply flex items-center gap-4;
	}

	.auth-button {
		@apply text-white hover:underline font-bold uppercase text-sm;
	}

	/* Mobile menu styles */
	.mobile-overlay {
		@apply fixed inset-0 bg-black/50 z-40;
	}

	.mobile-menu {
		@apply absolute top-full left-0 w-full border-t border-white/20 shadow-lg z-50;
		background-color: var(--color-dopoRed);
	}

	.mobile-nav {
		@apply flex flex-col;
	}

	.mobile-link {
		@apply block px-4 py-3 text-white font-bold uppercase text-sm hover:bg-white/10 transition-colors border-b border-white/10;
	}

	.mobile-auth {
		@apply p-4 border-t border-white/20;
	}

	.mobile-auth-button {
		@apply block w-full text-center px-4 py-3 text-white font-bold uppercase text-sm bg-white/10 rounded-lg hover:bg-white/20 transition-colors;
	}
</style>
