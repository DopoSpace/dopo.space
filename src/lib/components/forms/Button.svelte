<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		type?: 'button' | 'submit' | 'reset';
		variant?: 'primary' | 'secondary';
		loading?: boolean;
		disabled?: boolean;
		fullWidth?: boolean;
		children: Snippet;
	}

	let {
		type = 'button',
		variant = 'primary',
		loading = false,
		disabled = false,
		fullWidth = false,
		children
	}: Props = $props();

	const isDisabled = $derived(disabled || loading);
	const buttonClass = $derived(
		`btn-${variant} ${fullWidth ? 'w-full' : ''} ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}`
	);
</script>

<button {type} disabled={isDisabled} class={buttonClass}>
	{#if loading}
		<span class="inline-block h-4 w-4 animate-spin rounded-full border-2 border-solid border-white border-r-transparent mr-2"></span>
	{/if}
	{@render children()}
</button>
