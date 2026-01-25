<script lang="ts">
	import { page } from '$app/stores';
	import { localizeHref } from '$lib/paraglide/runtime';

	interface Props {
		to: string;
		item: string;
	}

	let { to, item }: Props = $props();

	// Localize the href to maintain current locale
	const localizedTo = $derived(localizeHref(to));

	// Check if active (compare base path without locale prefix) - with defensive checks
	const currentPath = $derived.by(() => {
		const pathname = ($page?.url?.pathname ?? '/') as string;
		// Strip /en prefix if present for comparison
		if (pathname.startsWith('/en/')) return pathname.slice(3);
		if (pathname === '/en') return '/';
		return pathname;
	});

	const isActive = $derived(currentPath === to);
</script>

<a href={localizedTo} class:underline={isActive}>
	{item}
</a>
