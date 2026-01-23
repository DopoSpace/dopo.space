<script lang="ts">
	import Menu from '$lib/components/Menu.svelte';
	import Footer from '$lib/components/Footer.svelte';
	import type { LayoutData } from './$types';
	import '../app.css';

	let { data, children }: { data: LayoutData; children: any } = $props();
</script>

{#if data.isAdminRoute}
	<!-- Admin routes use their own layout - no public menu or red background -->
	{@render children()}
{:else}
	<!-- Public routes get the standard menu and styling -->
	<Menu user={data.user} admin={data.admin} />
	<div class="flex flex-col bg-dopoRed min-h-screen">
		{@render children()}
		<Footer />
	</div>
{/if}
