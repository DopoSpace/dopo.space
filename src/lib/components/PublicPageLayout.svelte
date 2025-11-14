<script lang="ts">
	import type { Snippet } from 'svelte';
	import Menu from './Menu.svelte';

	interface Props {
		children: Snippet;
	}

	let { children }: Props = $props();
</script>

<Menu />
<div class="bg-dopoRed min-h-screen">
	{@render children()}
</div>
