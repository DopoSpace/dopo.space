<script lang="ts" module>
	export interface ListboxOption {
		value: string;
		label: string;
	}
</script>

<script lang="ts">
	import { tick } from 'svelte';

	interface Props {
		name: string;
		label: string;
		options: ListboxOption[];
		value?: string;
		error?: string;
		required?: boolean;
		disabled?: boolean;
		placeholder?: string;
		searchable?: boolean;
		searchPlaceholder?: string;
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
		placeholder = 'Seleziona...',
		searchable = false,
		searchPlaceholder = 'Cerca...',
		onchange,
		onblur
	}: Props = $props();

	// Internal state
	let isOpen = $state(false);
	let searchQuery = $state('');
	let highlightedIndex = $state(-1);
	let internalValue = $state('');
	let lastExternalValue = $state('');

	// Refs
	let containerRef: HTMLDivElement;
	let buttonRef: HTMLButtonElement;
	let listRef: HTMLUListElement;
	let searchInputRef: HTMLInputElement;

	// Sync internal value with external value prop
	$effect(() => {
		if (value !== lastExternalValue) {
			lastExternalValue = value;
			internalValue = value;
		}
	});

	// Filter options based on search query
	let filteredOptions = $derived(
		searchQuery
			? options.filter((opt) =>
					opt.label.toLowerCase().includes(searchQuery.toLowerCase())
				)
			: options
	);

	// Get selected option label
	let selectedLabel = $derived(
		options.find((opt) => opt.value === internalValue)?.label ?? ''
	);

	// Handle click outside to close dropdown
	function handleClickOutside(event: MouseEvent) {
		if (containerRef && !containerRef.contains(event.target as Node)) {
			closeDropdown();
		}
	}

	// Open dropdown
	async function openDropdown() {
		if (disabled) return;
		isOpen = true;
		searchQuery = '';
		highlightedIndex = internalValue
			? filteredOptions.findIndex((opt) => opt.value === internalValue)
			: 0;

		await tick();

		if (searchable && searchInputRef) {
			searchInputRef.focus();
		}

		// Scroll selected item into view
		scrollToHighlighted();

		document.addEventListener('click', handleClickOutside);
	}

	// Close dropdown
	function closeDropdown() {
		if (!isOpen) return;
		isOpen = false;
		searchQuery = '';
		highlightedIndex = -1;
		document.removeEventListener('click', handleClickOutside);

		if (onblur) {
			onblur(internalValue);
		}
	}

	// Toggle dropdown
	function toggleDropdown() {
		if (isOpen) {
			closeDropdown();
		} else {
			openDropdown();
		}
	}

	// Select an option
	function selectOption(option: ListboxOption) {
		internalValue = option.value;
		if (onchange) {
			onchange(option.value);
		}
		closeDropdown();
		buttonRef?.focus();
	}

	// Scroll highlighted item into view
	function scrollToHighlighted() {
		if (!listRef || highlightedIndex < 0) return;
		const items = listRef.querySelectorAll('[role="option"]');
		const item = items[highlightedIndex] as HTMLElement;
		if (item) {
			item.scrollIntoView({ block: 'nearest' });
		}
	}

	// Handle keyboard navigation
	function handleKeyDown(event: KeyboardEvent) {
		if (!isOpen) {
			if (event.key === 'Enter' || event.key === ' ' || event.key === 'ArrowDown') {
				event.preventDefault();
				openDropdown();
			}
			return;
		}

		switch (event.key) {
			case 'ArrowDown':
				event.preventDefault();
				highlightedIndex = Math.min(highlightedIndex + 1, filteredOptions.length - 1);
				scrollToHighlighted();
				break;
			case 'ArrowUp':
				event.preventDefault();
				highlightedIndex = Math.max(highlightedIndex - 1, 0);
				scrollToHighlighted();
				break;
			case 'Enter':
				event.preventDefault();
				if (highlightedIndex >= 0 && highlightedIndex < filteredOptions.length) {
					selectOption(filteredOptions[highlightedIndex]);
				}
				break;
			case 'Escape':
				event.preventDefault();
				closeDropdown();
				buttonRef?.focus();
				break;
			case 'Tab':
				closeDropdown();
				break;
			case 'Home':
				event.preventDefault();
				highlightedIndex = 0;
				scrollToHighlighted();
				break;
			case 'End':
				event.preventDefault();
				highlightedIndex = filteredOptions.length - 1;
				scrollToHighlighted();
				break;
		}
	}

	// Handle search input
	function handleSearchInput(event: Event) {
		const target = event.target as HTMLInputElement;
		searchQuery = target.value;
		highlightedIndex = 0;
	}

	// Reset highlighted index when filtered options change
	$effect(() => {
		if (filteredOptions.length > 0 && highlightedIndex >= filteredOptions.length) {
			highlightedIndex = 0;
		}
	});
</script>

<div class="mb-6 relative" bind:this={containerRef}>
	<label for={name} class="label text-gray-700">
		{label}
		{#if required}
			<span class="text-red-600">*</span>
		{/if}
	</label>

	<!-- Hidden input for form submission -->
	<input type="hidden" {name} value={internalValue} />

	<!-- Trigger button -->
	<button
		bind:this={buttonRef}
		type="button"
		id={name}
		class="listbox-button {error ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''} {disabled ? 'bg-gray-100 cursor-not-allowed opacity-60' : ''}"
		onclick={toggleDropdown}
		onkeydown={handleKeyDown}
		{disabled}
		aria-haspopup="listbox"
		aria-expanded={isOpen}
		aria-labelledby="{name}-label"
		aria-invalid={error ? 'true' : 'false'}
		aria-describedby={error ? `${name}-error` : undefined}
	>
		<span class="block truncate {!selectedLabel ? 'text-gray-400' : 'text-gray-900'}">
			{selectedLabel || placeholder}
		</span>
		<span class="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
			<svg
				class="h-4 w-4 text-gray-500 transition-transform duration-200 {isOpen ? 'rotate-180' : ''}"
				fill="none"
				viewBox="0 0 24 24"
				stroke="currentColor"
				stroke-width="2"
			>
				<path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
			</svg>
		</span>
	</button>

	<!-- Dropdown -->
	{#if isOpen}
		<div
			class="listbox-dropdown"
			role="presentation"
		>
			<!-- Search input -->
			{#if searchable}
				<div class="p-2 border-b border-gray-200">
					<input
						bind:this={searchInputRef}
						type="text"
						class="listbox-search"
						placeholder={searchPlaceholder}
						value={searchQuery}
						oninput={handleSearchInput}
						onkeydown={handleKeyDown}
						aria-label="Cerca opzioni"
					/>
				</div>
			{/if}

			<!-- Options list -->
			<ul
				bind:this={listRef}
				role="listbox"
				aria-labelledby="{name}-label"
				class="listbox-options"
				tabindex="-1"
			>
				{#if filteredOptions.length === 0}
					<li class="px-4 py-3 text-gray-500 text-sm">Nessun risultato</li>
				{:else}
					{#each filteredOptions as option, index}
						<li
							role="option"
							aria-selected={option.value === internalValue}
							class="listbox-option {option.value === internalValue ? 'selected' : ''} {index === highlightedIndex ? 'highlighted' : ''}"
							onmouseenter={() => (highlightedIndex = index)}
							onclick={() => selectOption(option)}
						>
							<span class="block truncate">{option.label}</span>
							{#if option.value === internalValue}
								<span class="absolute inset-y-0 right-0 flex items-center pr-3 text-blue-600">
									<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
										<path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
									</svg>
								</span>
							{/if}
						</li>
					{/each}
				{/if}
			</ul>
		</div>
	{/if}

	{#if error}
		<p id="{name}-error" class="text-red-600 text-sm mt-2">{error}</p>
	{/if}
</div>

<style>
	@reference "tailwindcss";

	.listbox-button {
		@apply relative w-full cursor-pointer rounded-lg border border-gray-300 bg-white py-2 pl-3 pr-10 text-left;
		@apply focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500;
	}

	.listbox-dropdown {
		@apply absolute z-50 mt-1 w-full overflow-hidden rounded-lg bg-white shadow-lg ring-1 ring-black/5;
	}

	.listbox-search {
		@apply w-full rounded-md border border-gray-300 px-3 py-2 text-sm;
		@apply focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500;
	}

	.listbox-options {
		@apply max-h-60 overflow-auto py-1 text-base focus:outline-none;
	}

	.listbox-option {
		@apply relative cursor-pointer select-none py-2.5 pl-4 pr-10 text-gray-900;
	}

	.listbox-option:hover,
	.listbox-option.highlighted {
		@apply bg-blue-50;
	}

	.listbox-option.selected {
		@apply bg-blue-100 font-medium;
	}

	.listbox-option.selected.highlighted {
		@apply bg-blue-100;
	}
</style>
