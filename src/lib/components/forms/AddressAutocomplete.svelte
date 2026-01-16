<script lang="ts">
	import { onMount } from 'svelte';

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
		label?: string;
		placeholder?: string;
		error?: string;
		onselect?: (result: AddressResult) => void;
	}

	let {
		label = 'Cerca indirizzo',
		placeholder = 'Inizia a digitare un indirizzo...',
		error,
		onselect
	}: Props = $props();

	let query = $state('');
	let results = $state<NominatimResult[]>([]);
	let isLoading = $state(false);
	let showDropdown = $state(false);
	let selectedIndex = $state(-1);
	let debounceTimer: ReturnType<typeof setTimeout>;

	// Map of Italian province names to codes
	const italianProvinces: Record<string, string> = {
		'agrigento': 'AG', 'alessandria': 'AL', 'ancona': 'AN', 'aosta': 'AO', 'arezzo': 'AR',
		'ascoli piceno': 'AP', 'asti': 'AT', 'avellino': 'AV', 'bari': 'BA', 'barletta-andria-trani': 'BT',
		'belluno': 'BL', 'benevento': 'BN', 'bergamo': 'BG', 'biella': 'BI', 'bologna': 'BO',
		'bolzano': 'BZ', 'brescia': 'BS', 'brindisi': 'BR', 'cagliari': 'CA', 'caltanissetta': 'CL',
		'campobasso': 'CB', 'caserta': 'CE', 'catania': 'CT', 'catanzaro': 'CZ', 'chieti': 'CH',
		'como': 'CO', 'cosenza': 'CS', 'cremona': 'CR', 'crotone': 'KR', 'cuneo': 'CN',
		'enna': 'EN', 'fermo': 'FM', 'ferrara': 'FE', 'firenze': 'FI', 'foggia': 'FG',
		'forlì-cesena': 'FC', 'frosinone': 'FR', 'genova': 'GE', 'gorizia': 'GO', 'grosseto': 'GR',
		'imperia': 'IM', 'isernia': 'IS', "l'aquila": 'AQ', 'la spezia': 'SP', 'latina': 'LT',
		'lecce': 'LE', 'lecco': 'LC', 'livorno': 'LI', 'lodi': 'LO', 'lucca': 'LU',
		'macerata': 'MC', 'mantova': 'MN', 'massa-carrara': 'MS', 'matera': 'MT', 'messina': 'ME',
		'milano': 'MI', 'modena': 'MO', 'monza e brianza': 'MB', 'napoli': 'NA', 'novara': 'NO',
		'nuoro': 'NU', 'oristano': 'OR', 'padova': 'PD', 'palermo': 'PA', 'parma': 'PR',
		'pavia': 'PV', 'perugia': 'PG', 'pesaro e urbino': 'PU', 'pescara': 'PE', 'piacenza': 'PC',
		'pisa': 'PI', 'pistoia': 'PT', 'pordenone': 'PN', 'potenza': 'PZ', 'prato': 'PO',
		'ragusa': 'RG', 'ravenna': 'RA', 'reggio calabria': 'RC', 'reggio emilia': 'RE', 'rieti': 'RI',
		'rimini': 'RN', 'roma': 'RM', 'rovigo': 'RO', 'salerno': 'SA', 'sassari': 'SS',
		'savona': 'SV', 'siena': 'SI', 'siracusa': 'SR', 'sondrio': 'SO', 'sud sardegna': 'SU',
		'taranto': 'TA', 'teramo': 'TE', 'terni': 'TR', 'torino': 'TO', 'trapani': 'TP',
		'trento': 'TN', 'treviso': 'TV', 'trieste': 'TS', 'udine': 'UD', 'varese': 'VA',
		'venezia': 'VE', 'verbano-cusio-ossola': 'VB', 'vercelli': 'VC', 'verona': 'VR',
		'vibo valentia': 'VV', 'vicenza': 'VI', 'viterbo': 'VT'
	};

	async function searchAddress(searchQuery: string) {
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

			const response = await fetch(
				`https://nominatim.openstreetmap.org/search?${params}`,
				{
					headers: {
						'Accept-Language': 'it',
						'User-Agent': 'DopoSpace/1.0'
					}
				}
			);

			if (response.ok) {
				results = await response.json();
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
		const target = event.target as HTMLInputElement;
		query = target.value;

		clearTimeout(debounceTimer);
		debounceTimer = setTimeout(() => {
			searchAddress(query);
		}, 350);
	}

	function getProvinceCode(countyOrState: string): string {
		if (!countyOrState) return '';
		const normalized = countyOrState.toLowerCase().trim();
		return italianProvinces[normalized] || countyOrState.slice(0, 2).toUpperCase();
	}

	function extractAddressData(result: NominatimResult): AddressResult {
		const addr = result.address;

		// Build street address
		let street = '';
		if (addr.road) {
			street = addr.road;
			if (addr.house_number) {
				street += `, ${addr.house_number}`;
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
		const addressData = extractAddressData(result);

		// Update query with the selected address
		query = addressData.address || result.display_name.split(',')[0];

		// Close dropdown
		showDropdown = false;
		results = [];

		// Notify parent
		if (onselect) {
			onselect(addressData);
		}
	}

	function handleKeydown(event: KeyboardEvent) {
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
		// Delay to allow click on result
		setTimeout(() => {
			showDropdown = false;
		}, 200);
	}

	function handleFocus() {
		if (results.length > 0) {
			showDropdown = true;
		}
	}

	onMount(() => {
		return () => {
			clearTimeout(debounceTimer);
		};
	});
</script>

<div class="relative mb-4">
	<label for="address-autocomplete" class="label text-gray-700">
		{label}
	</label>

	<div class="relative">
		<input
			id="address-autocomplete"
			type="text"
			value={query}
			oninput={handleInput}
			onkeydown={handleKeydown}
			onblur={handleBlur}
			onfocus={handleFocus}
			{placeholder}
			autocomplete="off"
			class="input text-gray-900 pr-10 {error ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''}"
			role="combobox"
			aria-expanded={showDropdown}
			aria-haspopup="listbox"
			aria-controls="address-results"
		/>

		{#if isLoading}
			<div class="absolute right-3 top-1/2 -translate-y-1/2">
				<svg class="animate-spin h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24">
					<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
					<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
				</svg>
			</div>
		{:else}
			<div class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
				<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
				</svg>
			</div>
		{/if}
	</div>

	{#if showDropdown && results.length > 0}
		<ul
			id="address-results"
			role="listbox"
			class="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto"
		>
			{#each results as result, index}
				<li
					role="option"
					aria-selected={index === selectedIndex}
					class="px-4 py-3 cursor-pointer border-b border-gray-100 last:border-b-0 {index === selectedIndex ? 'bg-orange-50' : 'hover:bg-gray-50'}"
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
		<p class="text-red-600 text-sm mt-1">{error}</p>
	{/if}

	<p class="text-xs text-gray-500 mt-1">
		Cerca un indirizzo e i campi verranno compilati automaticamente
	</p>
</div>
