<script lang="ts">
	import Button from './Button.svelte';

	interface Props {
		text: string;
		type?: 'button' | 'submit' | 'reset';
		variant?: 'primary' | 'secondary';
		loading?: boolean;
		disabled?: boolean;
		fullWidth?: boolean;
	}

	let { text, type, variant, loading, disabled, fullWidth }: Props = $props();
</script>

<Button {type} {variant} {loading} {disabled} {fullWidth}>
	{text}
</Button>
