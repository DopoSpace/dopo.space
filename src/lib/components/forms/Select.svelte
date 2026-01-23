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
		onblur?: (value: string) => void;
	}

	let {
		name,
		label,
		options,
		value = '',
		error,
		required = false,
		disabled = false,
		onchange,
		onblur
	}: Props = $props();

	// Internal state that syncs with the value prop
	let internalValue = $state('');
	let lastExternalValue = $state('');

	// Sync internal value with external value prop when it changes
	$effect(() => {
		if (value !== lastExternalValue) {
			lastExternalValue = value;
			internalValue = value;
		}
	});

	function handleChange(event: Event) {
		const target = event.target as HTMLSelectElement;
		internalValue = target.value;
		if (onchange) {
			onchange(target.value);
		}
	}

	function handleBlur() {
		if (onblur) {
			onblur(internalValue);
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
		class="select text-gray-900 {error ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''} {disabled ? 'bg-gray-100 cursor-not-allowed' : ''}"
		aria-invalid={error ? 'true' : 'false'}
		aria-describedby={error ? `${name}-error` : undefined}
		onchange={handleChange}
		onblur={handleBlur}
	>
		<option value="" disabled selected={!internalValue}>Seleziona...</option>
		{#each options as option}
			<option value={option.value} selected={internalValue === option.value}>{option.label}</option>
		{/each}
	</select>
	{#if error}
		<p id="{name}-error" class="text-red-600 text-sm mt-2">{error}</p>
	{/if}
</div>
