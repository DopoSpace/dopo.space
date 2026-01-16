<script lang="ts">
	interface Option {
		value: string;
		label: string;
	}

	interface Props {
		name: string;
		label: string;
		options: Option[];
		value?: string;
		error?: string;
		required?: boolean;
		disabled?: boolean;
		onchange?: (value: string) => void;
	}

	let {
		name,
		label,
		options,
		value = '',
		error,
		required = false,
		disabled = false,
		onchange
	}: Props = $props();

	function handleChange(event: Event) {
		const target = event.target as HTMLSelectElement;
		if (onchange) {
			onchange(target.value);
		}
	}
</script>

<div class="mb-6">
	<label for={name} class="label text-gray-700">
		{label}
		{#if required}
			<span class="text-red-600">*</span>
		{/if}
	</label>
	<select
		id={name}
		{name}
		{required}
		{disabled}
		class="input text-gray-900 {error ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''}"
		aria-invalid={error ? 'true' : 'false'}
		aria-describedby={error ? `${name}-error` : undefined}
		onchange={handleChange}
	>
		<option value="" disabled selected={!value}>Seleziona...</option>
		{#each options as option}
			<option value={option.value} selected={value === option.value}>{option.label}</option>
		{/each}
	</select>
	{#if error}
		<p id="{name}-error" class="text-red-600 text-sm mt-2">{error}</p>
	{/if}
</div>
