<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		children: Snippet;
	}

	let { children }: Props = $props();
</script>

<div class="text-3xl w-full md:w-4/5 px-4 py-16 flex flex-col gap-4">
	{@render children()}
</div>
