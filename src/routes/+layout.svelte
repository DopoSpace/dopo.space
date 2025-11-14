<script lang="ts">
	import Menu from '$lib/components/Menu.svelte';
	import type { LayoutData } from './$types';
	import '../app.css';

	let { data, children }: { data: LayoutData; children: any } = $props();
</script>

<Menu user={data.user} admin={data.admin} />
<div class="flex flex-col bg-dopoRed min-h-screen">
	{@render children()}
</div>
