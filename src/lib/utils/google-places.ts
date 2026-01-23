/**
 * Google Places Autocomplete Utilities
 *
 * Functions for loading the Google Maps API and extracting
 * address components from Google Places responses.
 */

/// <reference types="@types/google.maps" />

// Map of Italian province names to codes
export const italianProvinces: Record<string, string> = {
	agrigento: 'AG',
	alessandria: 'AL',
	ancona: 'AN',
	aosta: 'AO',
	arezzo: 'AR',
	'ascoli piceno': 'AP',
	asti: 'AT',
	avellino: 'AV',
	bari: 'BA',
	'barletta-andria-trani': 'BT',
	belluno: 'BL',
	benevento: 'BN',
	bergamo: 'BG',
	biella: 'BI',
	bologna: 'BO',
	bolzano: 'BZ',
	brescia: 'BS',
	brindisi: 'BR',
	cagliari: 'CA',
	caltanissetta: 'CL',
	campobasso: 'CB',
	caserta: 'CE',
	catania: 'CT',
	catanzaro: 'CZ',
	chieti: 'CH',
	como: 'CO',
	cosenza: 'CS',
	cremona: 'CR',
	crotone: 'KR',
	cuneo: 'CN',
	enna: 'EN',
	fermo: 'FM',
	ferrara: 'FE',
	firenze: 'FI',
	foggia: 'FG',
	'forli-cesena': 'FC',
	'forlì-cesena': 'FC',
	frosinone: 'FR',
	genova: 'GE',
	gorizia: 'GO',
	grosseto: 'GR',
	imperia: 'IM',
	isernia: 'IS',
	"l'aquila": 'AQ',
	'la spezia': 'SP',
	latina: 'LT',
	lecce: 'LE',
	lecco: 'LC',
	livorno: 'LI',
	lodi: 'LO',
	lucca: 'LU',
	macerata: 'MC',
	mantova: 'MN',
	'massa-carrara': 'MS',
	matera: 'MT',
	messina: 'ME',
	milano: 'MI',
	modena: 'MO',
	'monza e brianza': 'MB',
	'monza e della brianza': 'MB',
	napoli: 'NA',
	novara: 'NO',
	nuoro: 'NU',
	oristano: 'OR',
	padova: 'PD',
	palermo: 'PA',
	parma: 'PR',
	pavia: 'PV',
	perugia: 'PG',
	'pesaro e urbino': 'PU',
	pescara: 'PE',
	piacenza: 'PC',
	pisa: 'PI',
	pistoia: 'PT',
	pordenone: 'PN',
	potenza: 'PZ',
	prato: 'PO',
	ragusa: 'RG',
	ravenna: 'RA',
	'reggio calabria': 'RC',
	'reggio emilia': 'RE',
	"reggio nell'emilia": 'RE',
	rieti: 'RI',
	rimini: 'RN',
	roma: 'RM',
	rovigo: 'RO',
	salerno: 'SA',
	sassari: 'SS',
	savona: 'SV',
	siena: 'SI',
	siracusa: 'SR',
	sondrio: 'SO',
	'sud sardegna': 'SU',
	taranto: 'TA',
	teramo: 'TE',
	terni: 'TR',
	torino: 'TO',
	trapani: 'TP',
	trento: 'TN',
	treviso: 'TV',
	trieste: 'TS',
	udine: 'UD',
	varese: 'VA',
	venezia: 'VE',
	'verbano-cusio-ossola': 'VB',
	vercelli: 'VC',
	verona: 'VR',
	'vibo valentia': 'VV',
	vicenza: 'VI',
	viterbo: 'VT'
};

// Declare google on window
declare global {
	interface Window {
		google?: typeof google;
		initGoogleMapsCallback?: () => void;
	}
}

let googleMapsLoaded = false;
let googleMapsLoading: Promise<void> | null = null;

/**
 * Dynamically load Google Maps JavaScript API
 */
export function loadGoogleMapsApi(apiKey: string): Promise<void> {
	// Already loaded
	if (googleMapsLoaded && window.google?.maps?.places) {
		return Promise.resolve();
	}

	// Loading in progress
	if (googleMapsLoading) {
		return googleMapsLoading;
	}

	googleMapsLoading = new Promise((resolve, reject) => {
		// Check if already loaded by another script
		if (window.google?.maps?.places) {
			googleMapsLoaded = true;
			resolve();
			return;
		}

		const script = document.createElement('script');
		script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&language=it`;
		script.async = true;
		script.defer = true;

		script.onload = () => {
			googleMapsLoaded = true;
			resolve();
		};

		script.onerror = () => {
			googleMapsLoading = null;
			reject(new Error('Failed to load Google Maps API'));
		};

		document.head.appendChild(script);
	});

	return googleMapsLoading;
}

export interface AddressResult {
	address: string;
	city: string;
	postalCode: string;
	province: string;
	country: string;
	countryCode: string;
	fullAddress: string;
}

/**
 * Map province name to 2-letter code
 */
export function mapProvinceNameToCode(name: string): string {
	if (!name) return '';

	// If already a 2-letter code, return it
	if (/^[A-Z]{2}$/.test(name)) {
		return name;
	}

	const normalized = name.toLowerCase().trim();
	return italianProvinces[normalized] || name.slice(0, 2).toUpperCase();
}

/**
 * Extract address components from Google Place result
 */
export function extractAddressComponents(
	place: google.maps.places.PlaceResult,
	mode: 'address' | 'city' | 'country' = 'address'
): AddressResult {
	const components = place.address_components || [];

	let streetNumber = '';
	let route = '';
	let city = '';
	let postalCode = '';
	let province = '';
	let country = '';
	let countryCode = '';

	for (const component of components) {
		const types = component.types;

		if (types.includes('street_number')) {
			streetNumber = component.long_name;
		} else if (types.includes('route')) {
			route = component.long_name;
		} else if (
			types.includes('locality') ||
			types.includes('administrative_area_level_3')
		) {
			// locality is the city, administrative_area_level_3 is comune in Italy
			if (!city) {
				city = component.long_name;
			}
		} else if (types.includes('postal_code')) {
			postalCode = component.long_name;
		} else if (types.includes('administrative_area_level_2')) {
			// Province in Italy - short_name is already the 2-letter code
			province = component.short_name;
		} else if (types.includes('country')) {
			country = component.long_name;
			countryCode = component.short_name;
		}
	}

	// For Italy, ensure province is a valid 2-letter code
	if (countryCode === 'IT' && province) {
		province = mapProvinceNameToCode(province);
	}

	// Build street address
	let address = '';
	if (mode === 'address') {
		if (route) {
			address = route;
			if (streetNumber) {
				address += `, ${streetNumber}`;
			}
		}
	}

	return {
		address,
		city,
		postalCode,
		province,
		country,
		countryCode,
		fullAddress: place.formatted_address || ''
	};
}

/**
 * Check if Google Places API is available
 */
export function isGooglePlacesAvailable(): boolean {
	return googleMapsLoaded && !!window.google?.maps?.places;
}
