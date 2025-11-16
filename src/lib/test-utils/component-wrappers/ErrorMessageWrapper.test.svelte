<script lang="ts">
	import ErrorMessage from '$lib/components/forms/ErrorMessage.svelte';

	interface Props {
		text: string;
	}

	let { text }: Props = $props();
</script>

<ErrorMessage>
	{text}
</ErrorMessage>
