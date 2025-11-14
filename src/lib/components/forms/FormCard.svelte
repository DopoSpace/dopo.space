<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		title?: string;
		children: Snippet;
	}

	let { title, children }: Props = $props();
</script>

<div class="bg-white rounded-lg p-6 md:p-8 shadow-lg">
	{#if title}
		<h2 class="text-2xl md:text-3xl font-bold mb-6 text-gray-900">{title}</h2>
	{/if}
	{@render children()}
</div>
