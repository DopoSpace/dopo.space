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
		onblur?: (value: string) => void;
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
		disabled = false,
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

	function handleInput(event: Event) {
		const target = event.target as HTMLInputElement;
		internalValue = target.value;
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
	<input
		{type}
		id={name}
		{name}
		value={internalValue}
		oninput={handleInput}
		onblur={handleBlur}
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
