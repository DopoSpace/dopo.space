<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		children: Snippet;
		maxWidth?: string;
	}

	let { children, maxWidth = 'md:w-4/5' }: Props = $props();
</script>

<div class="text-3xl w-full {maxWidth} px-4 py-16 flex flex-col gap-4">
	{@render children()}
</div>
