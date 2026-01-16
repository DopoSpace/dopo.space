<script lang="ts">
	interface Props {
		name: string;
		label: string;
		checked?: boolean;
		error?: string;
		required?: boolean;
		disabled?: boolean;
		onchange?: (checked: boolean) => void;
	}

	let {
		name,
		label,
		checked = false,
		error,
		required = false,
		disabled = false,
		onchange
	}: Props = $props();

	function handleChange(event: Event) {
		const target = event.target as HTMLInputElement;
		if (onchange) {
			onchange(target.checked);
		}
	}
</script>

<div class="mb-6">
	<label class="flex items-start gap-3 cursor-pointer">
		<input
			type="checkbox"
			id={name}
			{name}
			{checked}
			{required}
			{disabled}
			value="true"
			class="mt-1 h-5 w-5 rounded border-gray-300 text-dopoRed focus:ring-dopoRed {error ? 'border-red-500' : ''}"
			aria-invalid={error ? 'true' : 'false'}
			aria-describedby={error ? `${name}-error` : undefined}
			onchange={handleChange}
		/>
		<span class="text-gray-700">
			{label}
			{#if required}
				<span class="text-red-600">*</span>
			{/if}
		</span>
	</label>
	{#if error}
		<p id="{name}-error" class="text-red-600 text-sm mt-2">{error}</p>
	{/if}
</div>
