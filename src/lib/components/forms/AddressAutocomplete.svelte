<script lang="ts">
	import { onMount } from 'svelte';
	import {
		loadGoogleMapsApi,
		extractAddressComponents,
		isGooglePlacesAvailable,
		italianProvinces
	} from '$lib/utils/google-places';

	export interface AddressResult {
		address: string;
		city: string;
		postalCode: string;
		province: string;
		country: string;
		countryCode: string;
		fullAddress: string;
	}

	interface NominatimResult {
		place_id: number;
		display_name: string;
		address: {
			road?: string;
			house_number?: string;
			city?: string;
			town?: string;
			village?: string;
			municipality?: string;
			county?: string;
			state?: string;
			postcode?: string;
			country?: string;
			country_code?: string;
		};
	}

	interface Props {
		name: string;
		label: string;
		value?: string;
		placeholder?: string;
		error?: string;
		required?: boolean;
		disabled?: boolean;
		apiKey?: string;
		mode?: 'address' | 'city' | 'country';
		excludeCountries?: string[];
		onselect?: (result: AddressResult) => void;
		onblur?: (value: string) => void;
	}

	let {
		name,
		label,
		value = '',
		placeholder = '',
		error,
		required = false,
		disabled = false,
		apiKey,
		mode = 'address',
		excludeCountries = [],
		onselect,
		onblur
	}: Props = $props();

	let query = $state('');
	let results = $state<NominatimResult[]>([]);
	let isLoading = $state(false);
	let showDropdown = $state(false);
	let selectedIndex = $state(-1);
	let debounceTimer: ReturnType<typeof setTimeout>;
	let lastExternalValue = $state('');

	// Provider state
	let provider = $state<'google' | 'nominatim'>('nominatim');
	let googleAutocomplete: google.maps.places.Autocomplete | null = null;
	let inputElement: HTMLInputElement | null = null;

	// Sync query with value prop only when value changes externally
	$effect(() => {
		if (value !== lastExternalValue) {
			lastExternalValue = value;
			query = value;
		}
	});

	// Initialize Google Places if API key is provided
	async function initGooglePlaces() {
		if (!apiKey || !inputElement) return;

		try {
			await loadGoogleMapsApi(apiKey);

			if (!isGooglePlacesAvailable()) {
				console.warn('Google Places API not available, falling back to Nominatim');
				return;
			}

			provider = 'google';

			// Configure autocomplete options based on mode
			const options: google.maps.places.AutocompleteOptions = {
				fields: ['address_components', 'formatted_address', 'name'],
				types: mode === 'address' ? ['address'] : mode === 'city' ? ['(cities)'] : ['country']
			};

			// Restrict to Italy only for city mode (birth city search)
			// Address mode allows worldwide search for foreign residence
			if (mode === 'city') {
				options.componentRestrictions = { country: 'it' };
			}

			googleAutocomplete = new google.maps.places.Autocomplete(inputElement, options);

			// Listen for place selection
			googleAutocomplete.addListener('place_changed', () => {
				const place = googleAutocomplete?.getPlace();
				if (place && place.address_components) {
					const addressData = extractAddressComponents(place, mode);

					// Check if country is excluded
					if (excludeCountries.length > 0 && addressData.countryCode) {
						const excludedUpper = excludeCountries.map((c) => c.toUpperCase());
						if (excludedUpper.includes(addressData.countryCode)) {
							// Clear selection - this country is not allowed
							query = '';
							return;
						}
					}

					// Update query with selected value
					if (mode === 'address') {
						query = addressData.address || place.formatted_address?.split(',')[0] || '';
					} else if (mode === 'city') {
						query = addressData.city || place.name || '';
					} else {
						// Country mode
						query = addressData.country || place.name || '';
					}

					// Notify parent
					if (onselect) {
						onselect(addressData);
					}
				}
			});
		} catch (err) {
			console.error('Failed to initialize Google Places:', err);
			provider = 'nominatim';
		}
	}

	// Nominatim fallback search
	async function searchNominatim(searchQuery: string) {
		if (searchQuery.length < 3) {
			results = [];
			showDropdown = false;
			return;
		}

		isLoading = true;

		try {
			const params = new URLSearchParams({
				q: searchQuery,
				format: 'json',
				addressdetails: '1',
				limit: '6'
			});

			// Restrict to Italy only for city mode (birth city search)
			// Address mode allows worldwide search for foreign residence
			if (mode === 'city') {
				params.set('countrycodes', 'it');
			}

			// Set featuretype based on mode
			if (mode === 'city') {
				params.set('featuretype', 'city');
			} else if (mode === 'country') {
				params.set('featuretype', 'country');
			}

			const response = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
				headers: {
					'Accept-Language': 'it',
					'User-Agent': 'DopoSpace/1.0'
				}
			});

			if (response.ok) {
				let allResults: NominatimResult[] = await response.json();
				// Filter out excluded countries
				if (excludeCountries.length > 0) {
					const excludedLower = excludeCountries.map((c) => c.toLowerCase());
					allResults = allResults.filter(
						(r) => !r.address.country_code || !excludedLower.includes(r.address.country_code)
					);
				}
				results = allResults;
				showDropdown = results.length > 0;
				selectedIndex = -1;
			}
		} catch (err) {
			console.error('Nominatim search error:', err);
			results = [];
		} finally {
			isLoading = false;
		}
	}

	function handleInput(event: Event) {
		// Don't process input when disabled
		if (disabled) return;

		const target = event.target as HTMLInputElement;
		query = target.value;

		// For Google provider, the autocomplete handles search automatically
		if (provider === 'google') {
			return;
		}

		// For Nominatim, debounce the search
		clearTimeout(debounceTimer);
		debounceTimer = setTimeout(() => {
			searchNominatim(query);
		}, 350);
	}

	function getProvinceCode(countyOrState: string): string {
		if (!countyOrState) return '';
		const normalized = countyOrState.toLowerCase().trim();
		return italianProvinces[normalized] || countyOrState.slice(0, 2).toUpperCase();
	}

	function extractNominatimData(result: NominatimResult): AddressResult {
		const addr = result.address;

		// Build street address
		let street = '';
		if (mode === 'address') {
			if (addr.road) {
				street = addr.road;
				if (addr.house_number) {
					street += `, ${addr.house_number}`;
				}
			}
		}

		// Get city (try different fields)
		const city = addr.city || addr.town || addr.village || addr.municipality || '';

		// Get province code for Italy
		let province = '';
		if (addr.country_code === 'it') {
			const countyOrState = addr.county || addr.state || '';
			province = getProvinceCode(countyOrState);
		} else {
			province = (addr.county || addr.state || '').slice(0, 2).toUpperCase();
		}

		return {
			address: street,
			city,
			postalCode: addr.postcode || '',
			province,
			country: addr.country || '',
			countryCode: addr.country_code?.toUpperCase() || '',
			fullAddress: result.display_name
		};
	}

	function selectResult(result: NominatimResult) {
		const addressData = extractNominatimData(result);

		// Update query with the selected value
		if (mode === 'address') {
			query = addressData.address || result.display_name.split(',')[0];
		} else if (mode === 'city') {
			query = addressData.city || result.display_name.split(',')[0];
		} else {
			// Country mode
			query = addressData.country || result.display_name.split(',')[0];
		}

		// Close dropdown
		showDropdown = false;
		results = [];

		// Notify parent
		if (onselect) {
			onselect(addressData);
		}
	}

	function handleKeydown(event: KeyboardEvent) {
		// Don't process keyboard events when disabled
		if (disabled) return;

		// For Google provider, let the autocomplete handle keyboard navigation
		if (provider === 'google') return;

		if (!showDropdown || results.length === 0) return;

		switch (event.key) {
			case 'ArrowDown':
				event.preventDefault();
				selectedIndex = Math.min(selectedIndex + 1, results.length - 1);
				break;
			case 'ArrowUp':
				event.preventDefault();
				selectedIndex = Math.max(selectedIndex - 1, 0);
				break;
			case 'Enter':
				event.preventDefault();
				if (selectedIndex >= 0 && selectedIndex < results.length) {
					selectResult(results[selectedIndex]);
				}
				break;
			case 'Escape':
				showDropdown = false;
				break;
		}
	}

	function handleBlur() {
		// For Nominatim, delay to allow click on result
		if (provider === 'nominatim') {
			setTimeout(() => {
				showDropdown = false;
			}, 200);
		}
		// Call onblur callback for validation after a short delay
		// to allow selection to complete first
		setTimeout(() => {
			if (onblur) {
				onblur(query);
			}
		}, 250);
	}

	function handleFocus() {
		if (provider === 'nominatim' && results.length > 0) {
			showDropdown = true;
		}
	}

	onMount(() => {
		// Try to initialize Google Places
		initGooglePlaces();

		return () => {
			clearTimeout(debounceTimer);
			// Clean up Google autocomplete
			if (googleAutocomplete) {
				google.maps.event.clearInstanceListeners(googleAutocomplete);
			}
		};
	});
</script>

<div class="relative mb-6">
	<label for={name} class="label text-gray-700">
		{label}
		{#if required}
			<span class="required">*</span>
		{/if}
	</label>

	<div class="relative">
		<input
			bind:this={inputElement}
			id={name}
			{name}
			type="text"
			value={query}
			oninput={handleInput}
			onkeydown={handleKeydown}
			onblur={handleBlur}
			onfocus={handleFocus}
			{placeholder}
			{required}
			{disabled}
			autocomplete="off"
			class="input text-gray-900 {error ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''} {disabled ? 'bg-gray-100 cursor-not-allowed opacity-60' : ''}"
			role="combobox"
			aria-expanded={provider === 'nominatim' ? showDropdown : false}
			aria-haspopup="listbox"
			aria-controls="results-{name}"
		/>

		{#if isLoading}
			<div class="absolute right-3 top-1/2 -translate-y-1/2">
				<svg class="animate-spin h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24">
					<circle
						class="opacity-25"
						cx="12"
						cy="12"
						r="10"
						stroke="currentColor"
						stroke-width="4"
					></circle>
					<path
						class="opacity-75"
						fill="currentColor"
						d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
					></path>
				</svg>
			</div>
		{/if}
	</div>

	<!-- Nominatim dropdown (Google shows its own) -->
	{#if provider === 'nominatim' && showDropdown && results.length > 0}
		<ul
			id="results-{name}"
			role="listbox"
			class="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto"
		>
			{#each results as result, index}
				<li
					role="option"
					aria-selected={index === selectedIndex}
					class="px-4 py-3 cursor-pointer border-b border-gray-100 last:border-b-0 {index ===
					selectedIndex
						? 'bg-orange-50'
						: 'hover:bg-gray-50'}"
					onmousedown={() => selectResult(result)}
				>
					<div class="text-sm text-gray-900 font-medium">
						{result.display_name.split(',').slice(0, 2).join(', ')}
					</div>
					<div class="text-xs text-gray-500 mt-0.5 truncate">
						{result.display_name.split(',').slice(2, 5).join(', ')}
					</div>
				</li>
			{/each}
		</ul>
	{/if}

	{#if error}
		<p class="error-message">{error}</p>
	{/if}
</div>

<style>
	@reference "tailwindcss";

	.error-message {
		@apply text-amber-300 text-base mt-2;
	}

	.required {
		@apply text-amber-400;
	}
</style>
