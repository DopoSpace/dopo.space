<script lang="ts">
	import AdminSidebar from '$lib/components/admin/AdminSidebar.svelte';
	import type { LayoutData } from './$types';

	let { data, children }: { data: LayoutData; children: any } = $props();

	// Show sidebar only if admin is logged in and not on login page
	let showSidebar = $derived(!!data.admin && !data.isLoginPage);

	// Mobile sidebar state
	let sidebarOpen = $state(false);

	function toggleSidebar() {
		sidebarOpen = !sidebarOpen;
	}

	function closeSidebar() {
		sidebarOpen = false;
	}
</script>

{#if showSidebar && data.admin}
	<div class="admin-layout">
		<!-- Mobile Header -->
		<header class="admin-mobile-header">
			<button
				type="button"
				onclick={toggleSidebar}
				class="p-2 rounded-md text-gray-300 hover:text-white hover:bg-gray-700 focus:outline-none"
				aria-label="Toggle menu"
			>
				<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					{#if sidebarOpen}
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
					{:else}
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
					{/if}
				</svg>
			</button>
			<h1>DopoSpace Admin</h1>
		</header>

		<!-- Overlay for mobile -->
		<div
			class="admin-overlay {sidebarOpen ? 'visible' : ''}"
			onclick={closeSidebar}
			onkeydown={(e) => e.key === 'Escape' && closeSidebar()}
			role="button"
			tabindex="-1"
			aria-label="Close menu"
		></div>

		<AdminSidebar admin={data.admin} isOpen={sidebarOpen} onClose={closeSidebar} />
		<main class="admin-content">
			{@render children()}
		</main>
	</div>
{:else}
	<!-- Login page: render without admin layout -->
	{@render children()}
{/if}
