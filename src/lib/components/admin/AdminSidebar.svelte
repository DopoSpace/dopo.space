<script lang="ts">
	import { page } from '$app/stores';
	import { enhance } from '$app/forms';

	interface AdminInfo {
		email: string;
		name?: string | null;
	}

	let { admin, isOpen = true, onClose }: { admin: AdminInfo; isOpen?: boolean; onClose?: () => void } = $props();

	const navItems = [
		{ href: '/admin/users', label: 'Utenti', icon: 'users' },
		{ href: '/admin/assign-cards', label: 'Assegna Tessere', icon: 'assign' },
		{ href: '/admin/card-ranges', label: 'Range Tessere', icon: 'card' }
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

<aside class="admin-sidebar {isOpen ? 'open' : ''}">
	<!-- Logo / Title -->
	<div class="px-6 py-5 border-b border-gray-700">
		<h1 class="text-xl font-bold text-white">DopoSpace</h1>
		<p class="text-xs text-gray-400 mt-1">Admin Panel</p>
	</div>

	<!-- Navigation -->
	<nav class="flex-1 py-4">
		{#each navItems as item}
			<a
				href={item.href}
				class="admin-sidebar-nav-item {isActive(item.href) ? 'active' : ''}"
				onclick={handleNavClick}
			>
				{#if item.icon === 'users'}
					<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
					</svg>
				{:else if item.icon === 'assign'}
					<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
					</svg>
				{:else if item.icon === 'card'}
					<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
					</svg>
				{/if}
				<span>{item.label}</span>
			</a>
		{/each}
	</nav>

	<!-- Admin Info & Logout -->
	<div class="border-t border-gray-700 p-4">
		<div class="mb-3">
			<p class="text-sm text-gray-400">Logged in as</p>
			<p class="text-sm font-medium text-white truncate">{admin.email}</p>
		</div>
		<form method="POST" action="/admin/logout" use:enhance>
			<button
				type="submit"
				class="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-gray-300 bg-gray-700 rounded-lg hover:bg-gray-600 hover:text-white transition-colors"
			>
				<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
				</svg>
				Logout
			</button>
		</form>
	</div>
</aside>
