<script lang="ts">
	import FormCard from './FormCard.svelte';

	interface Props {
		title?: string;
		content: string;
	}

	let { title, content }: Props = $props();
</script>

<FormCard {title}>
	{content}
</FormCard>
