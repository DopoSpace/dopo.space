/**
 * Cadastral Codes Database
 *
 * Maps Italian cadastral codes (codici catastali/Belfiore) to municipality names.
 * Used for tax code validation and birth place verification.
 *
 * Sources:
 * - Italian municipalities: https://github.com/matteocontrini/comuni-json
 * - Foreign countries: https://docs.italia.it/italia/anpr/anpr/it/stabile/tab/tab_stati_esteri.html
 */

/**
 * Municipality info
 */
export interface MunicipalityInfo {
	/** Municipality name */
	name: string;
	/** Province code (2 letters) or 'EE' for foreign */
	province: string;
	/** Whether this is a foreign country */
	isForeign?: boolean;
}

/**
 * Foreign country codes (stati esteri)
 * Format: Z + 3 digits
 */
export const FOREIGN_COUNTRIES: Record<string, MunicipalityInfo> = {
	Z100: { name: 'Albania', province: 'EE', isForeign: true },
	Z101: { name: 'Andorra', province: 'EE', isForeign: true },
	Z102: { name: 'Austria', province: 'EE', isForeign: true },
	Z103: { name: 'Belgio', province: 'EE', isForeign: true },
	Z104: { name: 'Bulgaria', province: 'EE', isForeign: true },
	Z106: { name: 'Città del Vaticano', province: 'EE', isForeign: true },
	Z107: { name: 'Danimarca', province: 'EE', isForeign: true },
	Z109: { name: 'Finlandia', province: 'EE', isForeign: true },
	Z110: { name: 'Francia', province: 'EE', isForeign: true },
	Z112: { name: 'Germania', province: 'EE', isForeign: true },
	Z114: { name: 'Regno Unito', province: 'EE', isForeign: true },
	Z115: { name: 'Grecia', province: 'EE', isForeign: true },
	Z116: { name: 'Irlanda', province: 'EE', isForeign: true },
	Z117: { name: 'Islanda', province: 'EE', isForeign: true },
	Z119: { name: 'Liechtenstein', province: 'EE', isForeign: true },
	Z120: { name: 'Lussemburgo', province: 'EE', isForeign: true },
	Z121: { name: 'Malta', province: 'EE', isForeign: true },
	Z123: { name: 'Monaco', province: 'EE', isForeign: true },
	Z125: { name: 'Norvegia', province: 'EE', isForeign: true },
	Z126: { name: 'Paesi Bassi', province: 'EE', isForeign: true },
	Z127: { name: 'Polonia', province: 'EE', isForeign: true },
	Z128: { name: 'Portogallo', province: 'EE', isForeign: true },
	Z129: { name: 'Romania', province: 'EE', isForeign: true },
	Z130: { name: 'San Marino', province: 'EE', isForeign: true },
	Z131: { name: 'Spagna', province: 'EE', isForeign: true },
	Z132: { name: 'Svezia', province: 'EE', isForeign: true },
	Z133: { name: 'Svizzera', province: 'EE', isForeign: true },
	Z134: { name: 'Ungheria', province: 'EE', isForeign: true },
	Z138: { name: 'Ucraina', province: 'EE', isForeign: true },
	Z139: { name: 'Bielorussia', province: 'EE', isForeign: true },
	Z140: { name: 'Moldova', province: 'EE', isForeign: true },
	Z144: { name: 'Estonia', province: 'EE', isForeign: true },
	Z145: { name: 'Lettonia', province: 'EE', isForeign: true },
	Z146: { name: 'Lituania', province: 'EE', isForeign: true },
	Z148: { name: 'Macedonia del Nord', province: 'EE', isForeign: true },
	Z149: { name: 'Croazia', province: 'EE', isForeign: true },
	Z150: { name: 'Slovenia', province: 'EE', isForeign: true },
	Z153: { name: 'Bosnia-Erzegovina', province: 'EE', isForeign: true },
	Z154: { name: 'Russia', province: 'EE', isForeign: true },
	Z155: { name: 'Slovacchia', province: 'EE', isForeign: true },
	Z156: { name: 'Repubblica Ceca', province: 'EE', isForeign: true },
	Z158: { name: 'Serbia', province: 'EE', isForeign: true },
	Z159: { name: 'Montenegro', province: 'EE', isForeign: true },
	Z160: { name: 'Kosovo', province: 'EE', isForeign: true },
	Z200: { name: 'Afghanistan', province: 'EE', isForeign: true },
	Z203: { name: 'Arabia Saudita', province: 'EE', isForeign: true },
	Z204: { name: 'Bahrein', province: 'EE', isForeign: true },
	Z205: { name: 'Bhutan', province: 'EE', isForeign: true },
	Z206: { name: 'Myanmar', province: 'EE', isForeign: true },
	Z207: { name: 'Brunei', province: 'EE', isForeign: true },
	Z208: { name: 'Cambogia', province: 'EE', isForeign: true },
	Z209: { name: 'Sri Lanka', province: 'EE', isForeign: true },
	Z210: { name: 'Cina', province: 'EE', isForeign: true },
	Z211: { name: 'Cipro', province: 'EE', isForeign: true },
	Z213: { name: 'Corea del Sud', province: 'EE', isForeign: true },
	Z214: { name: 'Corea del Nord', province: 'EE', isForeign: true },
	Z215: { name: 'Emirati Arabi Uniti', province: 'EE', isForeign: true },
	Z216: { name: 'Filippine', province: 'EE', isForeign: true },
	Z219: { name: 'Giappone', province: 'EE', isForeign: true },
	Z220: { name: 'Giordania', province: 'EE', isForeign: true },
	Z222: { name: 'India', province: 'EE', isForeign: true },
	Z223: { name: 'Indonesia', province: 'EE', isForeign: true },
	Z224: { name: 'Iran', province: 'EE', isForeign: true },
	Z225: { name: 'Iraq', province: 'EE', isForeign: true },
	Z226: { name: 'Israele', province: 'EE', isForeign: true },
	Z227: { name: 'Kuwait', province: 'EE', isForeign: true },
	Z228: { name: 'Laos', province: 'EE', isForeign: true },
	Z229: { name: 'Libano', province: 'EE', isForeign: true },
	Z232: { name: 'Maldive', province: 'EE', isForeign: true },
	Z233: { name: 'Mongolia', province: 'EE', isForeign: true },
	Z234: { name: 'Nepal', province: 'EE', isForeign: true },
	Z235: { name: 'Oman', province: 'EE', isForeign: true },
	Z236: { name: 'Pakistan', province: 'EE', isForeign: true },
	Z237: { name: 'Qatar', province: 'EE', isForeign: true },
	Z240: { name: 'Siria', province: 'EE', isForeign: true },
	Z241: { name: 'Thailandia', province: 'EE', isForeign: true },
	Z242: { name: 'Timor Est', province: 'EE', isForeign: true },
	Z243: { name: 'Turchia', province: 'EE', isForeign: true },
	Z246: { name: 'Yemen', province: 'EE', isForeign: true },
	Z247: { name: 'Malaysia', province: 'EE', isForeign: true },
	Z248: { name: 'Singapore', province: 'EE', isForeign: true },
	Z249: { name: 'Bangladesh', province: 'EE', isForeign: true },
	Z251: { name: 'Vietnam', province: 'EE', isForeign: true },
	Z252: { name: 'Armenia', province: 'EE', isForeign: true },
	Z253: { name: 'Azerbaigian', province: 'EE', isForeign: true },
	Z254: { name: 'Georgia', province: 'EE', isForeign: true },
	Z255: { name: 'Kazakistan', province: 'EE', isForeign: true },
	Z256: { name: 'Kirghizistan', province: 'EE', isForeign: true },
	Z257: { name: 'Tagikistan', province: 'EE', isForeign: true },
	Z258: { name: 'Turkmenistan', province: 'EE', isForeign: true },
	Z259: { name: 'Uzbekistan', province: 'EE', isForeign: true },
	Z300: { name: 'Namibia', province: 'EE', isForeign: true },
	Z301: { name: 'Algeria', province: 'EE', isForeign: true },
	Z302: { name: 'Angola', province: 'EE', isForeign: true },
	Z305: { name: 'Burundi', province: 'EE', isForeign: true },
	Z306: { name: 'Camerun', province: 'EE', isForeign: true },
	Z307: { name: 'Capo Verde', province: 'EE', isForeign: true },
	Z309: { name: 'Ciad', province: 'EE', isForeign: true },
	Z310: { name: 'Comore', province: 'EE', isForeign: true },
	Z311: { name: 'Congo', province: 'EE', isForeign: true },
	Z312: { name: 'Congo (Rep. Dem.)', province: 'EE', isForeign: true },
	Z313: { name: "Costa d'Avorio", province: 'EE', isForeign: true },
	Z314: { name: 'Benin', province: 'EE', isForeign: true },
	Z315: { name: 'Etiopia', province: 'EE', isForeign: true },
	Z316: { name: 'Gabon', province: 'EE', isForeign: true },
	Z317: { name: 'Gambia', province: 'EE', isForeign: true },
	Z318: { name: 'Ghana', province: 'EE', isForeign: true },
	Z319: { name: 'Guinea', province: 'EE', isForeign: true },
	Z320: { name: 'Guinea-Bissau', province: 'EE', isForeign: true },
	Z321: { name: 'Guinea Equatoriale', province: 'EE', isForeign: true },
	Z322: { name: 'Kenya', province: 'EE', isForeign: true },
	Z325: { name: 'Liberia', province: 'EE', isForeign: true },
	Z326: { name: 'Libia', province: 'EE', isForeign: true },
	Z327: { name: 'Madagascar', province: 'EE', isForeign: true },
	Z328: { name: 'Malawi', province: 'EE', isForeign: true },
	Z329: { name: 'Mali', province: 'EE', isForeign: true },
	Z330: { name: 'Marocco', province: 'EE', isForeign: true },
	Z331: { name: 'Mauritania', province: 'EE', isForeign: true },
	Z332: { name: 'Mauritius', province: 'EE', isForeign: true },
	Z333: { name: 'Mozambico', province: 'EE', isForeign: true },
	Z334: { name: 'Niger', province: 'EE', isForeign: true },
	Z335: { name: 'Nigeria', province: 'EE', isForeign: true },
	Z336: { name: 'Egitto', province: 'EE', isForeign: true },
	Z337: { name: 'Zimbabwe', province: 'EE', isForeign: true },
	Z338: { name: 'Ruanda', province: 'EE', isForeign: true },
	Z341: { name: 'Sao Tomé e Principe', province: 'EE', isForeign: true },
	Z342: { name: 'Seychelles', province: 'EE', isForeign: true },
	Z343: { name: 'Senegal', province: 'EE', isForeign: true },
	Z344: { name: 'Sierra Leone', province: 'EE', isForeign: true },
	Z345: { name: 'Somalia', province: 'EE', isForeign: true },
	Z347: { name: 'Sudafrica', province: 'EE', isForeign: true },
	Z348: { name: 'Sudan', province: 'EE', isForeign: true },
	Z349: { name: 'Eswatini', province: 'EE', isForeign: true },
	Z351: { name: 'Togo', province: 'EE', isForeign: true },
	Z352: { name: 'Tunisia', province: 'EE', isForeign: true },
	Z353: { name: 'Uganda', province: 'EE', isForeign: true },
	Z354: { name: 'Burkina Faso', province: 'EE', isForeign: true },
	Z355: { name: 'Zambia', province: 'EE', isForeign: true },
	Z357: { name: 'Tanzania', province: 'EE', isForeign: true },
	Z358: { name: 'Botswana', province: 'EE', isForeign: true },
	Z359: { name: 'Lesotho', province: 'EE', isForeign: true },
	Z361: { name: 'Gibuti', province: 'EE', isForeign: true },
	Z368: { name: 'Eritrea', province: 'EE', isForeign: true },
	Z401: { name: 'Canada', province: 'EE', isForeign: true },
	Z404: { name: 'Stati Uniti', province: 'EE', isForeign: true },
	Z502: { name: 'Bahamas', province: 'EE', isForeign: true },
	Z503: { name: 'Costa Rica', province: 'EE', isForeign: true },
	Z504: { name: 'Cuba', province: 'EE', isForeign: true },
	Z505: { name: 'Repubblica Dominicana', province: 'EE', isForeign: true },
	Z506: { name: 'El Salvador', province: 'EE', isForeign: true },
	Z507: { name: 'Giamaica', province: 'EE', isForeign: true },
	Z509: { name: 'Guatemala', province: 'EE', isForeign: true },
	Z510: { name: 'Haiti', province: 'EE', isForeign: true },
	Z511: { name: 'Honduras', province: 'EE', isForeign: true },
	Z514: { name: 'Messico', province: 'EE', isForeign: true },
	Z515: { name: 'Nicaragua', province: 'EE', isForeign: true },
	Z516: { name: 'Panama', province: 'EE', isForeign: true },
	Z522: { name: 'Barbados', province: 'EE', isForeign: true },
	Z524: { name: 'Grenada', province: 'EE', isForeign: true },
	Z526: { name: 'Dominica', province: 'EE', isForeign: true },
	Z527: { name: 'Saint Lucia', province: 'EE', isForeign: true },
	Z528: { name: 'Saint Vincent e Grenadine', province: 'EE', isForeign: true },
	Z532: { name: 'Antigua e Barbuda', province: 'EE', isForeign: true },
	Z533: { name: 'Saint Kitts e Nevis', province: 'EE', isForeign: true },
	Z600: { name: 'Argentina', province: 'EE', isForeign: true },
	Z601: { name: 'Bolivia', province: 'EE', isForeign: true },
	Z602: { name: 'Brasile', province: 'EE', isForeign: true },
	Z603: { name: 'Cile', province: 'EE', isForeign: true },
	Z604: { name: 'Colombia', province: 'EE', isForeign: true },
	Z605: { name: 'Ecuador', province: 'EE', isForeign: true },
	Z606: { name: 'Guyana', province: 'EE', isForeign: true },
	Z608: { name: 'Suriname', province: 'EE', isForeign: true },
	Z610: { name: 'Paraguay', province: 'EE', isForeign: true },
	Z611: { name: 'Perù', province: 'EE', isForeign: true },
	Z612: { name: 'Trinidad e Tobago', province: 'EE', isForeign: true },
	Z613: { name: 'Uruguay', province: 'EE', isForeign: true },
	Z614: { name: 'Venezuela', province: 'EE', isForeign: true },
	Z700: { name: 'Australia', province: 'EE', isForeign: true },
	Z703: { name: 'Isole Cook', province: 'EE', isForeign: true },
	Z704: { name: 'Figi', province: 'EE', isForeign: true },
	Z711: { name: 'Isole Marshall', province: 'EE', isForeign: true },
	Z713: { name: 'Nauru', province: 'EE', isForeign: true },
	Z719: { name: 'Nuova Zelanda', province: 'EE', isForeign: true },
	Z724: { name: 'Isole Salomone', province: 'EE', isForeign: true },
	Z726: { name: 'Samoa', province: 'EE', isForeign: true },
	Z728: { name: 'Tonga', province: 'EE', isForeign: true },
	Z730: { name: 'Papua Nuova Guinea', province: 'EE', isForeign: true },
	Z731: { name: 'Kiribati', province: 'EE', isForeign: true },
	Z732: { name: 'Tuvalu', province: 'EE', isForeign: true },
	Z733: { name: 'Vanuatu', province: 'EE', isForeign: true },
	Z734: { name: 'Palau', province: 'EE', isForeign: true },
	Z735: { name: 'Micronesia', province: 'EE', isForeign: true },
	Z907: { name: 'Sud Sudan', province: 'EE', isForeign: true }
};

// The Italian municipalities data is loaded dynamically to keep the bundle smaller
// This will be populated on first use
let _italianMunicipalities: Record<string, MunicipalityInfo> | null = null;

/**
 * Load Italian municipalities data
 * Uses dynamic import for better code splitting
 */
async function loadItalianMunicipalities(): Promise<Record<string, MunicipalityInfo>> {
	if (_italianMunicipalities) {
		return _italianMunicipalities;
	}

	// Import the municipalities data
	const { ITALIAN_MUNICIPALITIES } = await import('./italian-municipalities');
	_italianMunicipalities = ITALIAN_MUNICIPALITIES;
	return _italianMunicipalities;
}

/**
 * Lookup municipality by cadastral code
 *
 * @param code - The cadastral code (e.g., "H501" for Roma, "Z100" for Albania)
 * @returns Municipality info or null if not found
 */
export async function lookupCadastralCode(code: string): Promise<MunicipalityInfo | null> {
	if (!code) return null;

	const upperCode = code.toUpperCase().trim();

	// Check foreign countries first (starts with Z)
	if (upperCode.startsWith('Z')) {
		return FOREIGN_COUNTRIES[upperCode] || null;
	}

	// Check Italian municipalities
	const municipalities = await loadItalianMunicipalities();
	return municipalities[upperCode] || null;
}

/**
 * Lookup municipality by cadastral code (synchronous version)
 * Only works after municipalities have been loaded at least once
 *
 * @param code - The cadastral code
 * @returns Municipality info or null if not found
 */
export function lookupCadastralCodeSync(code: string): MunicipalityInfo | null {
	if (!code) return null;

	const upperCode = code.toUpperCase().trim();

	// Check foreign countries first
	if (upperCode.startsWith('Z')) {
		return FOREIGN_COUNTRIES[upperCode] || null;
	}

	// Check Italian municipalities (may return null if not loaded yet)
	return _italianMunicipalities?.[upperCode] || null;
}

/**
 * Check if a cadastral code is valid (exists in database)
 *
 * @param code - The cadastral code
 * @returns true if valid
 */
export async function isValidCadastralCode(code: string): Promise<boolean> {
	return (await lookupCadastralCode(code)) !== null;
}

/**
 * Check if a cadastral code is for a foreign country
 *
 * @param code - The cadastral code
 * @returns true if foreign country
 */
export function isForeignCadastralCode(code: string): boolean {
	if (!code) return false;
	return code.toUpperCase().trim().startsWith('Z');
}

/**
 * Omocodia reverse map: letter → digit
 * Used to convert omocodia letters back to digits for cadastral code extraction
 */
const OMOCODIA_REVERSE: Record<string, string> = {
	L: '0',
	M: '1',
	N: '2',
	P: '3',
	Q: '4',
	R: '5',
	S: '6',
	T: '7',
	U: '8',
	V: '9'
};

/**
 * Extract cadastral code from a tax code (Codice Fiscale)
 * Handles omocodia (where digits are replaced with letters)
 *
 * @param taxCode - The Italian tax code (16 characters)
 * @returns The cadastral code (4 characters) or null if invalid
 */
export function extractCadastralCodeFromTaxCode(taxCode: string): string | null {
	if (!taxCode || taxCode.length !== 16) return null;

	const upper = taxCode.toUpperCase();

	// Cadastral code is at positions 11-14 (0-indexed)
	// Format: 1 letter + 3 digits (e.g., "H501" for Roma)
	// Positions 12, 13, 14 can have omocodia letters instead of digits

	const letter = upper.charAt(11); // First char is always a letter
	const digits: string[] = [];

	// Extract and normalize the 3 digit positions (may have omocodia letters)
	for (let i = 12; i < 15; i++) {
		const char = upper.charAt(i);
		// Convert omocodia letters back to digits
		digits.push(OMOCODIA_REVERSE[char] ?? char);
	}

	return letter + digits.join('');
}

/**
 * Preload municipalities data
 * Call this at app startup for better performance
 */
export async function preloadMunicipalities(): Promise<void> {
	await loadItalianMunicipalities();
}

/**
 * Get birth place information from a tax code
 *
 * @param taxCode - The Italian tax code (16 characters)
 * @returns Municipality info or null if not found
 */
export async function getBirthPlaceFromTaxCode(taxCode: string): Promise<MunicipalityInfo | null> {
	const cadastralCode = extractCadastralCodeFromTaxCode(taxCode);
	if (!cadastralCode) return null;

	return lookupCadastralCode(cadastralCode);
}

/**
 * Result of comparing birth place in file vs CF
 */
export interface BirthPlaceComparisonResult {
	/** Whether the comparison could be performed */
	valid: boolean;
	/** Municipality info from CF */
	municipalityFromCF: MunicipalityInfo | null;
	/** The cadastral code extracted from CF */
	cadastralCode: string | null;
	/** Whether the birth city matches */
	cityMatches: boolean;
	/** Whether the birth province matches */
	provinceMatches: boolean;
	/** Suggested correction for birth city */
	suggestedCity?: string;
	/** Suggested correction for birth province */
	suggestedProvince?: string;
	/** Error message if validation failed */
	error?: string;
}

/**
 * Normalize a city name for comparison
 * Removes common variations and normalizes case
 */
function normalizeCityForComparison(city: string): string {
	if (!city) return '';

	return city
		.toUpperCase()
		.trim()
		// Remove ISTAT code suffix (e.g., "Catania - C351" → "CATANIA")
		.replace(/\s*-\s*[A-Z]\d{3}$/i, '')
		// Normalize apostrophes and quotes
		.replace(/[''`]/g, "'")
		// Remove accents for fuzzy matching
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		// Common variations
		.replace(/^S\.?\s*/i, 'SAN ')
		.replace(/^SS\.?\s*/i, 'SANTI ')
		.replace(/^S\s+/i, 'SAN ')
		.trim();
}

// Reverse lookup cache: normalized city name -> cadastral code
let _reverseLookupCache: Map<string, string> | null = null;

/**
 * Build reverse lookup cache for finding cadastral codes by city name
 */
async function buildReverseLookupCache(): Promise<Map<string, string>> {
	if (_reverseLookupCache) {
		return _reverseLookupCache;
	}

	_reverseLookupCache = new Map();
	const municipalities = await loadItalianMunicipalities();

	// Add Italian municipalities
	for (const [code, info] of Object.entries(municipalities)) {
		// Create multiple keys for fuzzy matching
		const normalizedName = normalizeCityForComparison(info.name);
		const keyWithProvince = `${normalizedName}|${info.province}`;
		const keyWithoutProvince = normalizedName;

		// Store with province (more specific)
		_reverseLookupCache.set(keyWithProvince, code);
		// Store without province (fallback, may be overwritten by duplicates)
		if (!_reverseLookupCache.has(keyWithoutProvince)) {
			_reverseLookupCache.set(keyWithoutProvince, code);
		}
	}

	// Add foreign countries
	for (const [code, info] of Object.entries(FOREIGN_COUNTRIES)) {
		const normalizedName = normalizeCityForComparison(info.name);
		_reverseLookupCache.set(`${normalizedName}|EE`, code);
		if (!_reverseLookupCache.has(normalizedName)) {
			_reverseLookupCache.set(normalizedName, code);
		}
	}

	return _reverseLookupCache;
}

/**
 * Find cadastral code by city name and optionally province
 *
 * @param cityName - The city/municipality name
 * @param province - Optional 2-letter province code (helps disambiguate)
 * @returns Cadastral code or null if not found
 */
export async function findCadastralCodeByCity(
	cityName: string,
	province?: string
): Promise<string | null> {
	if (!cityName) return null;

	const cache = await buildReverseLookupCache();
	const normalizedCity = normalizeCityForComparison(cityName);

	// Try with province first (more specific)
	if (province) {
		const keyWithProvince = `${normalizedCity}|${province.toUpperCase().trim()}`;
		const codeWithProvince = cache.get(keyWithProvince);
		if (codeWithProvince) {
			return codeWithProvince;
		}
	}

	// Fallback to just city name
	return cache.get(normalizedCity) || null;
}

/**
 * Compare birth place from file with birth place encoded in CF
 *
 * @param taxCode - The Italian tax code
 * @param birthCityFromFile - Birth city from import file
 * @param birthProvinceFromFile - Birth province from import file
 * @returns Comparison result with suggestions
 */
export async function compareBirthPlace(
	taxCode: string,
	birthCityFromFile: string,
	birthProvinceFromFile: string
): Promise<BirthPlaceComparisonResult> {
	// Extract cadastral code from CF
	const cadastralCode = extractCadastralCodeFromTaxCode(taxCode);

	if (!cadastralCode) {
		return {
			valid: false,
			municipalityFromCF: null,
			cadastralCode: null,
			cityMatches: false,
			provinceMatches: false,
			error: 'Impossibile estrarre il codice catastale dal CF'
		};
	}

	// Look up the municipality
	const municipality = await lookupCadastralCode(cadastralCode);

	if (!municipality) {
		return {
			valid: false,
			municipalityFromCF: null,
			cadastralCode,
			cityMatches: false,
			provinceMatches: false,
			error: `Codice catastale ${cadastralCode} non trovato nel database`
		};
	}

	// Normalize city names for comparison
	const normalizedFileCity = normalizeCityForComparison(birthCityFromFile);
	const normalizedCFCity = normalizeCityForComparison(municipality.name);

	// Compare cities (fuzzy match)
	const cityMatches =
		normalizedFileCity === normalizedCFCity ||
		normalizedFileCity.includes(normalizedCFCity) ||
		normalizedCFCity.includes(normalizedFileCity);

	// Compare provinces
	const normalizedFileProvince = (birthProvinceFromFile || '').toUpperCase().trim();
	const provinceMatches =
		normalizedFileProvince === municipality.province ||
		// "EE" in file matches any foreign country
		(normalizedFileProvince === 'EE' && municipality.isForeign === true);

	return {
		valid: true,
		municipalityFromCF: municipality,
		cadastralCode,
		cityMatches,
		provinceMatches,
		suggestedCity: cityMatches ? undefined : municipality.name,
		suggestedProvince: provinceMatches ? undefined : municipality.province
	};
}
