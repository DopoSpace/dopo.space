<script lang="ts">
	import MenuItem from './MenuItem.svelte';
	import { navigationItems } from '$lib/config/navigation';
	import { page } from '$app/stores';

	interface Props {
		user?: { id: string; email: string } | null;
		admin?: { id: string; email: string } | null;
	}

	let { user = null, admin = null }: Props = $props();
	
	// Nascondi "Login" se siamo già sulla pagina di login
	let isLoginPage = $derived($page.url.pathname === '/auth/login' || $page.url.pathname === '/admin/login');
	
	// Determine logout action based on user type
	let logoutAction = $derived(admin ? '/admin/logout' : '/auth/logout');
	let isAuthenticated = $derived(!!user || !!admin);
</script>

<div class="absolute top-0 left-0 bg-dopoRed px-4 py-2 w-full">
	<div class="flex justify-between items-center gap-4">
		<div class="flex items-center gap-4">
			{#each navigationItems as { to, label }}
				<MenuItem {to} item={label} />
			{/each}
		</div>

		<div>
			{#if isAuthenticated}
				<form method="POST" action={logoutAction}>
					<button type="submit" class="text-white hover:underline font-bold uppercase text-sm">
						Logout
					</button>
				</form>
			{:else if !isLoginPage}
				<MenuItem to="/auth/login" item="Login" />
			{/if}
		</div>
	</div>
</div>
