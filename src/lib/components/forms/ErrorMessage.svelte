<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		children: Snippet;
	}

	let { children }: Props = $props();
</script>

<div class="bg-red-50 border border-red-200 text-red-800 rounded-lg p-4 mb-6" role="alert">
	<p class="text-sm font-medium">
		{@render children()}
	</p>
</div>
