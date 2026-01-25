<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import Menu from '$lib/components/Menu.svelte';
	import Footer from '$lib/components/Footer.svelte';
	import CookieBanner from '$lib/components/CookieBanner.svelte';
	import { trackPageView, setAnalyticsConsent } from '$lib/analytics';
	import { cookieConsent } from '$lib/stores/cookieConsent';
	import type { LayoutData } from './$types';
	import '../app.css';

	let { data, children }: { data: LayoutData; children: any } = $props();

	onMount(() => {
		cookieConsent.init();
		if ($cookieConsent.consent?.analytics) {
			setAnalyticsConsent(true);
		}
	});

	$effect(() => {
		trackPageView($page.url.pathname);
	});

	function handleAcceptAll(): void {
		setAnalyticsConsent(true);
	}

	// Limit user/admin data to only what Menu needs (security: prevent unnecessary data serialization)
	const menuUser = $derived(
		data.user ? { id: data.user.id, email: data.user.email } : null
	);
	const menuAdmin = $derived(
		data.admin ? { id: data.admin.id, email: data.admin.email } : null
	);
</script>

{#if data.isAdminRoute}
	<!-- Admin routes use their own layout - no public menu or red background -->
	{@render children()}
{:else}
	<!-- Public routes get the standard menu and styling -->
	<Menu user={menuUser} admin={menuAdmin} />
	<div class="flex flex-col bg-dopoRed min-h-screen">
		{@render children()}
		<Footer />
	</div>
	<CookieBanner onAcceptAll={handleAcceptAll} />
{/if}
