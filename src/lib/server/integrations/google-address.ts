/**
 * Google Address Validation Integration
 *
 * Provides address validation and normalization using Google Address Validation API.
 * Documentation: https://developers.google.com/maps/documentation/address-validation
 *
 * Note: This API requires a Google Cloud project with:
 * - Address Validation API enabled
 * - Billing enabled
 * - API key with Address Validation API access
 *
 * Cost: ~$0.017 per request (~$17 per 1000 requests)
 */

import { getGoogleAddressValidationApiKey, getGooglePlacesApiKey } from '$lib/server/config/env';
import pino from 'pino';

const logger = pino({ name: 'google-address' });

const GOOGLE_ADDRESS_VALIDATION_API = 'https://addressvalidation.googleapis.com/v1:validateAddress';

/**
 * Confidence level for address validation
 */
export type AddressConfidence = 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';

/**
 * Normalized address result
 */
export interface NormalizedAddress {
	street: string;
	city: string;
	province: string; // Italian province code (2 letters)
	postalCode: string;
	country: string; // ISO 3166-1 alpha-2
	formattedAddress: string;
}

/**
 * Result of address validation
 */
export interface AddressValidationResult {
	isValid: boolean;
	normalizedAddress: NormalizedAddress | null;
	confidence: AddressConfidence;
	suggestedCorrections: string[];
	error?: string;
}

/**
 * Result of birth city validation
 */
export interface BirthCityValidationResult {
	isValid: boolean;
	normalizedName: string | null;
	province: string | null; // Province code if found
	error?: string;
}

/**
 * Google Address Validation API response types
 */
interface GoogleAddressComponent {
	componentName: {
		text: string;
		languageCode?: string;
	};
	componentType: string;
	confirmationLevel: 'CONFIRMED' | 'UNCONFIRMED_BUT_PLAUSIBLE' | 'UNCONFIRMED_AND_SUSPICIOUS';
}

interface GoogleAddress {
	formattedAddress: string;
	postalAddress: {
		regionCode: string;
		languageCode: string;
		postalCode: string;
		administrativeArea: string;
		locality: string;
		addressLines: string[];
	};
	addressComponents: GoogleAddressComponent[];
}

interface GoogleVerdict {
	inputGranularity:
		| 'GRANULARITY_UNSPECIFIED'
		| 'SUB_PREMISE'
		| 'PREMISE'
		| 'PREMISE_PROXIMITY'
		| 'BLOCK'
		| 'ROUTE'
		| 'OTHER';
	validationGranularity:
		| 'GRANULARITY_UNSPECIFIED'
		| 'SUB_PREMISE'
		| 'PREMISE'
		| 'PREMISE_PROXIMITY'
		| 'BLOCK'
		| 'ROUTE'
		| 'OTHER';
	geocodeGranularity:
		| 'GRANULARITY_UNSPECIFIED'
		| 'SUB_PREMISE'
		| 'PREMISE'
		| 'PREMISE_PROXIMITY'
		| 'BLOCK'
		| 'ROUTE'
		| 'OTHER';
	addressComplete: boolean;
	hasUnconfirmedComponents: boolean;
	hasInferredComponents: boolean;
	hasReplacedComponents: boolean;
}

interface GoogleAddressValidationResponse {
	result: {
		verdict: GoogleVerdict;
		address: GoogleAddress;
		geocode?: unknown;
		metadata?: unknown;
	};
	responseId: string;
}

/**
 * Italian province codes mapping (from province name to code)
 */
const PROVINCE_NAME_TO_CODE: Record<string, string> = {
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
	'carbonia-iglesias': 'CI',
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
	florence: 'FI',
	foggia: 'FG',
	'forlì-cesena': 'FC',
	frosinone: 'FR',
	genova: 'GE',
	genoa: 'GE',
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
	'medio campidano': 'VS',
	messina: 'ME',
	milano: 'MI',
	milan: 'MI',
	modena: 'MO',
	'monza e brianza': 'MB',
	napoli: 'NA',
	naples: 'NA',
	novara: 'NO',
	nuoro: 'NU',
	ogliastra: 'OG',
	'olbia-tempio': 'OT',
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
	rieti: 'RI',
	rimini: 'RN',
	roma: 'RM',
	rome: 'RM',
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
	turin: 'TO',
	trapani: 'TP',
	trento: 'TN',
	treviso: 'TV',
	trieste: 'TS',
	udine: 'UD',
	varese: 'VA',
	venezia: 'VE',
	venice: 'VE',
	'verbano-cusio-ossola': 'VB',
	vercelli: 'VC',
	verona: 'VR',
	'vibo valentia': 'VV',
	vicenza: 'VI',
	viterbo: 'VT'
};

/**
 * Convert province name to 2-letter code
 */
function getProvinceCode(provinceName: string): string | null {
	const normalized = provinceName.toLowerCase().trim();

	// Check if it's already a code
	if (/^[A-Z]{2}$/i.test(provinceName.trim())) {
		return provinceName.trim().toUpperCase();
	}

	return PROVINCE_NAME_TO_CODE[normalized] || null;
}

/**
 * Determine confidence level based on Google verdict
 */
function getConfidenceLevel(verdict: GoogleVerdict): AddressConfidence {
	if (verdict.addressComplete && !verdict.hasUnconfirmedComponents) {
		return 'HIGH';
	}

	if (verdict.addressComplete && verdict.hasUnconfirmedComponents) {
		return 'MEDIUM';
	}

	if (!verdict.addressComplete && !verdict.hasUnconfirmedComponents) {
		return 'MEDIUM';
	}

	if (verdict.hasReplacedComponents) {
		return 'LOW';
	}

	return 'NONE';
}

/**
 * Extract address components from Google response
 */
function extractAddressComponents(address: GoogleAddress): NormalizedAddress | null {
	const postalAddress = address.postalAddress;

	if (!postalAddress) {
		return null;
	}

	// Extract street from address lines
	const street = postalAddress.addressLines?.join(', ') || '';

	// Get province code
	const provinceCode = getProvinceCode(postalAddress.administrativeArea || '');

	return {
		street,
		city: postalAddress.locality || '',
		province: provinceCode || postalAddress.administrativeArea || '',
		postalCode: postalAddress.postalCode || '',
		country: postalAddress.regionCode || 'IT',
		formattedAddress: address.formattedAddress || ''
	};
}

/**
 * Validate and normalize an Italian address using Google Address Validation API
 *
 * @param address - Street address
 * @param city - City/municipality name
 * @param province - Province code or name
 * @param cap - Italian postal code (CAP)
 * @returns Validation result with normalized address if valid
 */
export async function validateAddress(
	address: string,
	city: string,
	province: string,
	cap: string
): Promise<AddressValidationResult> {
	const apiKey = getGoogleAddressValidationApiKey();

	// If no API key, skip validation and return as-is
	if (!apiKey) {
		logger.warn('Google Address Validation API key not configured, skipping validation');
		return {
			isValid: true,
			normalizedAddress: {
				street: address.trim(),
				city: city.trim(),
				province: province.toUpperCase().trim(),
				postalCode: cap.trim(),
				country: 'IT',
				formattedAddress: `${address}, ${cap} ${city} ${province}, Italia`
			},
			confidence: 'NONE',
			suggestedCorrections: []
		};
	}

	try {
		// Build the full address string
		const fullAddress = `${address}, ${cap} ${city} ${province}, Italia`;

		const response = await fetch(`${GOOGLE_ADDRESS_VALIDATION_API}?key=${apiKey}`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				address: {
					regionCode: 'IT',
					addressLines: [fullAddress]
				},
				enableUspsCass: false
			})
		});

		if (!response.ok) {
			const errorText = await response.text();
			logger.error({ status: response.status, error: errorText }, 'Google Address Validation API error');
			return {
				isValid: false,
				normalizedAddress: null,
				confidence: 'NONE',
				suggestedCorrections: [],
				error: `API error: ${response.status}`
			};
		}

		const data: GoogleAddressValidationResponse = await response.json();
		const { verdict, address: googleAddress } = data.result;

		const normalizedAddress = extractAddressComponents(googleAddress);
		const confidence = getConfidenceLevel(verdict);

		// Collect suggested corrections
		const suggestedCorrections: string[] = [];

		if (verdict.hasReplacedComponents) {
			suggestedCorrections.push('Alcuni componenti dell\'indirizzo sono stati corretti');
		}

		if (verdict.hasInferredComponents) {
			suggestedCorrections.push('Alcuni componenti dell\'indirizzo sono stati dedotti');
		}

		// Consider address valid if confidence is at least MEDIUM
		const isValid = confidence === 'HIGH' || confidence === 'MEDIUM';

		return {
			isValid,
			normalizedAddress,
			confidence,
			suggestedCorrections
		};
	} catch (error) {
		logger.error({ error }, 'Failed to validate address with Google API');
		return {
			isValid: false,
			normalizedAddress: null,
			confidence: 'NONE',
			suggestedCorrections: [],
			error: error instanceof Error ? error.message : 'Unknown error'
		};
	}
}

/**
 * Validate and normalize a birth city name
 *
 * @param city - Birth city name
 * @param province - Province code or name (optional, for better matching)
 * @returns Validation result with normalized city name
 */
export async function validateBirthCity(
	city: string,
	province?: string
): Promise<BirthCityValidationResult> {
	const apiKey = getGoogleAddressValidationApiKey();

	// If no API key, skip validation and return as-is
	if (!apiKey) {
		logger.warn('Google Address Validation API key not configured, skipping birth city validation');
		return {
			isValid: true,
			normalizedName: city.trim(),
			province: province ? getProvinceCode(province) : null
		};
	}

	try {
		// Build a simple address with just city and province
		const addressParts = [city];
		if (province && province !== 'EE') {
			addressParts.push(province);
		}
		addressParts.push('Italia');

		const fullAddress = addressParts.join(', ');

		const response = await fetch(`${GOOGLE_ADDRESS_VALIDATION_API}?key=${apiKey}`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				address: {
					regionCode: 'IT',
					addressLines: [fullAddress]
				},
				enableUspsCass: false
			})
		});

		if (!response.ok) {
			const errorText = await response.text();
			logger.error({ status: response.status, error: errorText }, 'Google Address Validation API error');
			return {
				isValid: false,
				normalizedName: null,
				province: null,
				error: `API error: ${response.status}`
			};
		}

		const data: GoogleAddressValidationResponse = await response.json();
		const { address: googleAddress } = data.result;

		const postalAddress = googleAddress.postalAddress;

		if (!postalAddress || !postalAddress.locality) {
			return {
				isValid: false,
				normalizedName: null,
				province: null,
				error: 'Comune non trovato'
			};
		}

		const provinceCode = getProvinceCode(postalAddress.administrativeArea || '');

		return {
			isValid: true,
			normalizedName: postalAddress.locality,
			province: provinceCode
		};
	} catch (error) {
		logger.error({ error }, 'Failed to validate birth city with Google API');
		return {
			isValid: false,
			normalizedName: null,
			province: null,
			error: error instanceof Error ? error.message : 'Unknown error'
		};
	}
}

/**
 * Check if Google Address Validation API is configured
 */
export function isGoogleAddressValidationConfigured(): boolean {
	return !!getGoogleAddressValidationApiKey();
}

/**
 * Simple rate limiter for Google API calls
 * Implements a token bucket algorithm with max 6000 requests per minute
 */
class RateLimiter {
	private tokens: number;
	private lastRefill: number;
	private readonly maxTokens: number;
	private readonly refillRate: number; // tokens per millisecond

	constructor(maxRequestsPerMinute: number = 6000) {
		this.maxTokens = maxRequestsPerMinute;
		this.tokens = maxRequestsPerMinute;
		this.lastRefill = Date.now();
		this.refillRate = maxRequestsPerMinute / 60000; // per millisecond
	}

	async acquire(): Promise<void> {
		this.refill();

		if (this.tokens < 1) {
			// Calculate wait time until we have a token
			const waitTime = Math.ceil((1 - this.tokens) / this.refillRate);
			await new Promise((resolve) => setTimeout(resolve, waitTime));
			this.refill();
		}

		this.tokens -= 1;
	}

	private refill(): void {
		const now = Date.now();
		const elapsed = now - this.lastRefill;
		this.tokens = Math.min(this.maxTokens, this.tokens + elapsed * this.refillRate);
		this.lastRefill = now;
	}
}

// Global rate limiter instance
const rateLimiter = new RateLimiter(6000);

/**
 * Validate address with rate limiting
 * Use this for batch operations to avoid exceeding API limits
 */
export async function validateAddressRateLimited(
	address: string,
	city: string,
	province: string,
	cap: string
): Promise<AddressValidationResult> {
	await rateLimiter.acquire();
	return validateAddress(address, city, province, cap);
}

/**
 * Validate birth city with rate limiting
 * Use this for batch operations to avoid exceeding API limits
 */
export async function validateBirthCityRateLimited(
	city: string,
	province?: string
): Promise<BirthCityValidationResult> {
	await rateLimiter.acquire();
	return validateBirthCity(city, province);
}

// ============================================================================
// Geocoding API for detecting foreign cities
// ============================================================================

const GOOGLE_GEOCODING_API = 'https://maps.googleapis.com/maps/api/geocode/json';

/**
 * Result of city country detection
 */
export interface CityCountryResult {
	found: boolean;
	cityName: string | null;
	countryCode: string | null; // ISO 3166-1 alpha-2 (IT, BE, GB, etc.)
	countryName: string | null;
	isItalian: boolean;
	error?: string;
}

/**
 * Detect which country a city is in using Google Geocoding API
 * Much cheaper than Address Validation API (~$5/1000 requests vs $17/1000)
 *
 * @param cityName - The city name to look up
 * @returns Country information for the city
 */
export async function detectCityCountry(cityName: string): Promise<CityCountryResult> {
	const apiKey = getGooglePlacesApiKey();

	// If no API key, return unknown
	if (!apiKey) {
		logger.warn('Google API key not configured, cannot detect city country');
		return {
			found: false,
			cityName: null,
			countryCode: null,
			countryName: null,
			isItalian: false,
			error: 'API key not configured'
		};
	}

	try {
		const params = new URLSearchParams({
			address: cityName,
			key: apiKey
		});

		const response = await fetch(`${GOOGLE_GEOCODING_API}?${params}`);

		if (!response.ok) {
			logger.error({ status: response.status }, 'Google Geocoding API error');
			return {
				found: false,
				cityName: null,
				countryCode: null,
				countryName: null,
				isItalian: false,
				error: `API error: ${response.status}`
			};
		}

		const data = await response.json();

		if (data.status !== 'OK' || !data.results || data.results.length === 0) {
			return {
				found: false,
				cityName: null,
				countryCode: null,
				countryName: null,
				isItalian: false,
				error: data.status === 'ZERO_RESULTS' ? 'City not found' : data.status
			};
		}

		// Get the first result
		const result = data.results[0];
		const addressComponents = result.address_components || [];

		// Find country component
		let countryCode: string | null = null;
		let countryName: string | null = null;
		let localityName: string | null = null;

		for (const component of addressComponents) {
			const types = component.types || [];

			if (types.includes('country')) {
				countryCode = component.short_name; // e.g., "IT", "BE", "GB"
				countryName = component.long_name; // e.g., "Italy", "Belgium", "United Kingdom"
			}

			if (types.includes('locality') || types.includes('administrative_area_level_3')) {
				localityName = component.long_name;
			}
		}

		const isItalian = countryCode === 'IT';

		logger.debug(
			{ cityName, countryCode, countryName, isItalian },
			'City country detected'
		);

		return {
			found: true,
			cityName: localityName || cityName,
			countryCode,
			countryName,
			isItalian
		};
	} catch (error) {
		logger.error({ error, cityName }, 'Failed to detect city country');
		return {
			found: false,
			cityName: null,
			countryCode: null,
			countryName: null,
			isItalian: false,
			error: error instanceof Error ? error.message : 'Unknown error'
		};
	}
}

/**
 * Detect city country with rate limiting
 * Use this for batch operations to avoid exceeding API limits
 */
export async function detectCityCountryRateLimited(cityName: string): Promise<CityCountryResult> {
	await rateLimiter.acquire();
	return detectCityCountry(cityName);
}

/**
 * Check if Google Geocoding API is configured
 */
export function isGoogleGeocodingConfigured(): boolean {
	return !!getGooglePlacesApiKey();
}
