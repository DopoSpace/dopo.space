<script lang="ts">
	interface Props {
		name: string;
		label: string;
		type?: string;
		value?: string;
		error?: string;
		required?: boolean;
		placeholder?: string;
	}

	let {
		name,
		label,
		type = 'text',
		value = '',
		error,
		required = false,
		placeholder
	}: Props = $props();

	// Use $state to track the internal value, initialized from props
	// This allows proper two-way binding while respecting prop updates
	let inputValue = $state(value);

	// Use $effect to sync inputValue when the prop changes
	// This ensures the input updates when parent data changes (e.g., after form submission)
	$effect(() => {
		inputValue = value;
	});
</script>

<div class="mb-6">
	<label for={name} class="label text-gray-700">
		{label}
		{#if required}
			<span class="text-red-600">*</span>
		{/if}
	</label>
	<input
		{type}
		id={name}
		{name}
		bind:value={inputValue}
		{required}
		{placeholder}
		class="input text-gray-900 {error ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''}"
		aria-invalid={error ? 'true' : 'false'}
		aria-describedby={error ? `${name}-error` : undefined}
	/>
	{#if error}
		<p id="{name}-error" class="text-red-600 text-sm mt-2">{error}</p>
	{/if}
</div>
