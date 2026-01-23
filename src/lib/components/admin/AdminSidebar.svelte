<script lang="ts">
	import { page } from '$app/stores';
	import { enhance } from '$app/forms';

	interface AdminInfo {
		email: string;
		name?: string | null;
	}

	let {
		admin,
		isOpen = true,
		isCollapsed = false,
		onClose,
		onToggleCollapse
	}: {
		admin: AdminInfo;
		isOpen?: boolean;
		isCollapsed?: boolean;
		onClose?: () => void;
		onToggleCollapse?: () => void;
	} = $props();

	const navItems = [
		{ href: '/admin/users', label: 'Utenti', icon: 'users' },
		{ href: '/admin/assign-cards', label: 'Assegna Tessere', icon: 'assign' },
		{ href: '/admin/card-ranges', label: 'Range Tessere', icon: 'card' },
		{ href: '/admin/settings', label: 'Impostazioni', icon: 'settings' },
		{ href: '/admin/maintenance', label: 'Manutenzione', icon: 'maintenance' }
	];

	function isActive(href: string): boolean {
		return $page.url.pathname.startsWith(href);
	}

	function handleNavClick() {
		if (onClose) {
			onClose();
		}
	}
</script>

<aside class="admin-sidebar {isOpen ? 'open' : ''} {isCollapsed ? 'collapsed' : ''}">
	<!-- Logo / Title -->
	<div class="sidebar-header">
		{#if !isCollapsed}
			<h1 class="text-xl font-bold text-white">DopoSpace</h1>
			<p class="text-xs text-gray-400 mt-1">Admin Panel</p>
		{:else}
			<h1 class="text-lg font-bold text-white">DS</h1>
		{/if}
	</div>

	<!-- Collapse Toggle Button (desktop only) -->
	<button
		type="button"
		onclick={onToggleCollapse}
		class="collapse-toggle"
		aria-label={isCollapsed ? 'Espandi sidebar' : 'Comprimi sidebar'}
		title={isCollapsed ? 'Espandi' : 'Comprimi'}
	>
		<svg class="w-4 h-4 transition-transform {isCollapsed ? 'rotate-180' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
		</svg>
	</button>

	<!-- Navigation -->
	<nav class="flex-1 py-4">
		{#each navItems as item}
			<a
				href={item.href}
				class="admin-sidebar-nav-item {isActive(item.href) ? 'active' : ''} {isCollapsed ? 'collapsed' : ''}"
				onclick={handleNavClick}
				title={isCollapsed ? item.label : ''}
			>
				{#if item.icon === 'users'}
					<svg class="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
					</svg>
				{:else if item.icon === 'assign'}
					<svg class="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
					</svg>
				{:else if item.icon === 'card'}
					<svg class="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
					</svg>
				{:else if item.icon === 'settings'}
					<svg class="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
					</svg>
				{:else if item.icon === 'maintenance'}
					<svg class="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
					</svg>
				{/if}
				{#if !isCollapsed}
					<span>{item.label}</span>
				{/if}
			</a>
		{/each}
	</nav>

	<!-- Admin Info & Logout -->
	<div class="sidebar-footer">
		{#if !isCollapsed}
			<div class="mb-3">
				<p class="text-sm text-gray-400">Logged in as</p>
				<p class="text-sm font-medium text-white truncate">{admin.email}</p>
			</div>
		{/if}
		<form method="POST" action="/logout" use:enhance>
			<button
				type="submit"
				class="logout-button {isCollapsed ? 'collapsed' : ''}"
				title={isCollapsed ? 'Logout' : ''}
			>
				<svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
				</svg>
				{#if !isCollapsed}
					<span>Logout</span>
				{/if}
			</button>
		</form>
	</div>
</aside>
