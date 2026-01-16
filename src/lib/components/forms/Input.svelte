<script lang="ts">
	interface Props {
		name: string;
		label: string;
		type?: string;
		value?: string;
		error?: string;
		required?: boolean;
		placeholder?: string;
		maxlength?: number;
		disabled?: boolean;
	}

	let {
		name,
		label,
		type = 'text',
		value = '',
		error,
		required = false,
		placeholder,
		maxlength,
		disabled = false
	}: Props = $props();
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
		{value}
		{required}
		{placeholder}
		{maxlength}
		{disabled}
		class="input text-gray-900 {error ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''} {disabled ? 'bg-gray-100 cursor-not-allowed' : ''}"
		aria-invalid={error ? 'true' : 'false'}
		aria-describedby={error ? `${name}-error` : undefined}
	/>
	{#if error}
		<p id="{name}-error" class="text-red-600 text-sm mt-2">{error}</p>
	{/if}
</div>
