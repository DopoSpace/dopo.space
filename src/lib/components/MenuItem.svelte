<script lang="ts">
	import { page } from '$app/stores';

	interface Props {
		to: string;
		item: string;
	}

	let { to, item }: Props = $props();

	let isActive = $derived($page.url.pathname === to);
</script>

<a href={to} class:underline={isActive}>
	{item}
</a>
