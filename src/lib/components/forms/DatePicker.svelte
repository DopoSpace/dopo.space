<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import flatpickr from 'flatpickr';
	import { Italian } from 'flatpickr/dist/l10n/it.js';
	import { english } from 'flatpickr/dist/l10n/default.js';
	import 'flatpickr/dist/flatpickr.min.css';
	import { getLocale } from '$lib/paraglide/runtime';

	interface Props {
		name: string;
		label: string;
		value?: string;
		placeholder?: string;
		error?: string;
		required?: boolean;
		disabled?: boolean;
		maxDate?: string | Date;
		minDate?: string | Date;
		onchange?: (value: string) => void;
		onblur?: (value: string) => void;
	}

	let {
		name,
		label,
		value = '',
		placeholder = 'Seleziona data...',
		error,
		required = false,
		disabled = false,
		maxDate,
		minDate,
		onchange,
		onblur
	}: Props = $props();

	let inputElement: HTMLInputElement;
	let flatpickrInstance: flatpickr.Instance | null = null;
	let internalValue = $state(value);

	// Get the appropriate flatpickr locale based on current language
	function getFlatpickrLocale() {
		const currentLocale = getLocale();
		return currentLocale === 'en' ? english : Italian;
	}

	// Sync with external value changes
	$effect(() => {
		if (value !== internalValue && flatpickrInstance) {
			internalValue = value;
			flatpickrInstance.setDate(value, false);
		}
	});

	onMount(() => {
		flatpickrInstance = flatpickr(inputElement, {
			locale: getFlatpickrLocale(),
			dateFormat: 'Y-m-d',
			altInput: true,
			altFormat: 'd/m/Y', // Always use European format (day/month/year)
			allowInput: true,
			maxDate: maxDate,
			minDate: minDate,
			defaultDate: value || undefined,
			disableMobile: true, // Force custom picker on mobile too
			monthSelectorType: 'static', // Use text + arrows instead of dropdown
			onChange: (selectedDates, dateStr) => {
				internalValue = dateStr;
				if (onchange) {
					onchange(dateStr);
				}
			},
			onClose: () => {
				if (onblur) {
					onblur(internalValue);
				}
			}
		});
	});

	onDestroy(() => {
		if (flatpickrInstance) {
			flatpickrInstance.destroy();
		}
	});
</script>

<div class="datepicker-wrapper">
	<label for={name} class="label">
		{label}
		{#if required}
			<span class="required">*</span>
		{/if}
	</label>

	<div class="datepicker-input-wrapper">
		<input
			bind:this={inputElement}
			id={name}
			{name}
			type="text"
			{placeholder}
			{required}
			{disabled}
			class="datepicker-input {error ? 'has-error' : ''} {disabled ? 'disabled' : ''}"
			aria-invalid={error ? 'true' : 'false'}
			aria-describedby={error ? `${name}-error` : undefined}
		/>
		<div class="datepicker-icon">
			<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
				<path stroke-linecap="round" stroke-linejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
			</svg>
		</div>
	</div>

	{#if error}
		<p id="{name}-error" class="error-message">{error}</p>
	{/if}
</div>

<style>
	@reference "tailwindcss";

	.datepicker-wrapper {
		@apply mb-6;
	}

	.label {
		@apply block text-lg md:text-xl text-white/90 mb-2;
	}

	.required {
		@apply text-amber-400;
	}

	.datepicker-input-wrapper {
		@apply relative;
	}

	.datepicker-input {
		@apply w-full px-4 py-4 text-xl md:text-2xl;
		@apply bg-transparent border-2 border-white/50 rounded-lg;
		@apply text-white placeholder-white/50;
		@apply focus:border-white focus:outline-none;
		@apply cursor-pointer;
	}

	.datepicker-input.has-error {
		@apply border-amber-400;
	}

	.datepicker-input.disabled {
		@apply opacity-50 cursor-not-allowed;
	}

	.datepicker-icon {
		@apply absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none;
	}

	.datepicker-icon svg {
		@apply w-6 h-6 text-white/70;
	}

	.error-message {
		@apply text-amber-300 text-base mt-2;
	}

	/* Flatpickr theme customization */
	:global(.flatpickr-calendar) {
		@apply bg-white rounded-lg shadow-xl border-2 border-gray-200;
		font-family: inherit;
	}

	:global(.flatpickr-months) {
		@apply bg-white rounded-t-lg;
	}

	:global(.flatpickr-month) {
		@apply text-gray-900 fill-gray-900;
	}

	:global(.flatpickr-current-month) {
		@apply text-gray-900;
	}

	:global(.flatpickr-current-month .flatpickr-monthDropdown-months) {
		@apply bg-white text-gray-900;
	}

	:global(.flatpickr-current-month input.cur-year) {
		@apply text-gray-900;
	}

	:global(.flatpickr-months .flatpickr-prev-month),
	:global(.flatpickr-months .flatpickr-next-month) {
		@apply fill-gray-700 hover:fill-gray-900;
	}

	:global(.flatpickr-months .flatpickr-prev-month svg),
	:global(.flatpickr-months .flatpickr-next-month svg) {
		@apply fill-gray-700;
	}

	:global(.flatpickr-weekdays) {
		@apply bg-gray-50;
	}

	:global(.flatpickr-weekday) {
		@apply text-gray-600 font-medium;
	}

	:global(.flatpickr-days) {
		@apply bg-white;
	}

	:global(.flatpickr-day) {
		@apply text-gray-900 hover:bg-orange-50 rounded-lg;
	}

	:global(.flatpickr-day.today) {
		@apply border-orange-400;
	}

	:global(.flatpickr-day.selected) {
		@apply bg-orange-500 text-white border-orange-500;
	}

	:global(.flatpickr-day.selected:hover) {
		@apply bg-orange-600 border-orange-600;
	}

	:global(.flatpickr-day.prevMonthDay),
	:global(.flatpickr-day.nextMonthDay) {
		@apply text-gray-400;
	}

	:global(.flatpickr-day.disabled) {
		@apply text-gray-300 cursor-not-allowed;
	}

	/* Hide the native calendar icon in the alt input */
	:global(.flatpickr-input[readonly]) {
		cursor: pointer;
	}

	/* Static month selector styling */
	:global(.flatpickr-current-month) {
		@apply flex items-center justify-center gap-2 font-semibold;
	}

	:global(.flatpickr-current-month .cur-month) {
		@apply font-semibold text-gray-900;
	}

	:global(.flatpickr-current-month .numInputWrapper) {
		@apply inline-flex items-center;
	}

	:global(.flatpickr-current-month .numInputWrapper input) {
		@apply font-semibold text-gray-900 bg-transparent;
	}

	:global(.flatpickr-current-month .numInputWrapper span) {
		@apply text-gray-500 hover:text-gray-900;
	}
</style>
