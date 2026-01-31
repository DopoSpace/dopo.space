/**
 * Italian CAP (Postal Code) Database
 *
 * Provides lookup functions for Italian postal codes and cities.
 * Covers provincial capitals (capoluoghi) where CAP follows the pattern XX100-XX199.
 *
 * Note: This is not comprehensive for all 8000+ comuni, but covers:
 * - All provincial capitals (capoluoghi di provincia)
 * - Major cities with multiple CAPs
 */

/**
 * Province info with CAP range
 */
export interface ProvinceCapInfo {
	/** Capoluogo (provincial capital) name */
	capoluogo: string;
	/** Province code (2 letters) */
	province: string;
	/** CAP prefix (first 2-3 digits) */
	capPrefix: string;
	/** Main CAP for the capoluogo */
	mainCap: string;
	/** CAP range min (for the capoluogo) */
	capMin: number;
	/** CAP range max (for the capoluogo) */
	capMax: number;
}

/**
 * Italian provincial capitals with CAP information
 * Key: 2-letter province code
 */
export const PROVINCE_CAP_INFO: Record<string, ProvinceCapInfo> = {
	AG: { capoluogo: 'Agrigento', province: 'AG', capPrefix: '92', mainCap: '92100', capMin: 92100, capMax: 92100 },
	AL: { capoluogo: 'Alessandria', province: 'AL', capPrefix: '15', mainCap: '15121', capMin: 15121, capMax: 15122 },
	AN: { capoluogo: 'Ancona', province: 'AN', capPrefix: '60', mainCap: '60121', capMin: 60121, capMax: 60131 },
	AO: { capoluogo: 'Aosta', province: 'AO', capPrefix: '11', mainCap: '11100', capMin: 11100, capMax: 11100 },
	AR: { capoluogo: 'Arezzo', province: 'AR', capPrefix: '52', mainCap: '52100', capMin: 52100, capMax: 52100 },
	AP: { capoluogo: 'Ascoli Piceno', province: 'AP', capPrefix: '63', mainCap: '63100', capMin: 63100, capMax: 63100 },
	AT: { capoluogo: 'Asti', province: 'AT', capPrefix: '14', mainCap: '14100', capMin: 14100, capMax: 14100 },
	AV: { capoluogo: 'Avellino', province: 'AV', capPrefix: '83', mainCap: '83100', capMin: 83100, capMax: 83100 },
	BA: { capoluogo: 'Bari', province: 'BA', capPrefix: '70', mainCap: '70121', capMin: 70121, capMax: 70132 },
	BT: { capoluogo: 'Barletta', province: 'BT', capPrefix: '76', mainCap: '76121', capMin: 76121, capMax: 76125 },
	BL: { capoluogo: 'Belluno', province: 'BL', capPrefix: '32', mainCap: '32100', capMin: 32100, capMax: 32100 },
	BN: { capoluogo: 'Benevento', province: 'BN', capPrefix: '82', mainCap: '82100', capMin: 82100, capMax: 82100 },
	BG: { capoluogo: 'Bergamo', province: 'BG', capPrefix: '24', mainCap: '24121', capMin: 24121, capMax: 24129 },
	BI: { capoluogo: 'Biella', province: 'BI', capPrefix: '13', mainCap: '13900', capMin: 13900, capMax: 13900 },
	BO: { capoluogo: 'Bologna', province: 'BO', capPrefix: '40', mainCap: '40121', capMin: 40121, capMax: 40141 },
	BZ: { capoluogo: 'Bolzano', province: 'BZ', capPrefix: '39', mainCap: '39100', capMin: 39100, capMax: 39100 },
	BS: { capoluogo: 'Brescia', province: 'BS', capPrefix: '25', mainCap: '25121', capMin: 25121, capMax: 25136 },
	BR: { capoluogo: 'Brindisi', province: 'BR', capPrefix: '72', mainCap: '72100', capMin: 72100, capMax: 72100 },
	CA: { capoluogo: 'Cagliari', province: 'CA', capPrefix: '09', mainCap: '09121', capMin: 9121, capMax: 9134 },
	CL: { capoluogo: 'Caltanissetta', province: 'CL', capPrefix: '93', mainCap: '93100', capMin: 93100, capMax: 93100 },
	CB: { capoluogo: 'Campobasso', province: 'CB', capPrefix: '86', mainCap: '86100', capMin: 86100, capMax: 86100 },
	CE: { capoluogo: 'Caserta', province: 'CE', capPrefix: '81', mainCap: '81100', capMin: 81100, capMax: 81100 },
	CT: { capoluogo: 'Catania', province: 'CT', capPrefix: '95', mainCap: '95121', capMin: 95121, capMax: 95131 },
	CZ: { capoluogo: 'Catanzaro', province: 'CZ', capPrefix: '88', mainCap: '88100', capMin: 88100, capMax: 88100 },
	CH: { capoluogo: 'Chieti', province: 'CH', capPrefix: '66', mainCap: '66100', capMin: 66100, capMax: 66100 },
	CO: { capoluogo: 'Como', province: 'CO', capPrefix: '22', mainCap: '22100', capMin: 22100, capMax: 22100 },
	CS: { capoluogo: 'Cosenza', province: 'CS', capPrefix: '87', mainCap: '87100', capMin: 87100, capMax: 87100 },
	CR: { capoluogo: 'Cremona', province: 'CR', capPrefix: '26', mainCap: '26100', capMin: 26100, capMax: 26100 },
	KR: { capoluogo: 'Crotone', province: 'KR', capPrefix: '88', mainCap: '88900', capMin: 88900, capMax: 88900 },
	CN: { capoluogo: 'Cuneo', province: 'CN', capPrefix: '12', mainCap: '12100', capMin: 12100, capMax: 12100 },
	EN: { capoluogo: 'Enna', province: 'EN', capPrefix: '94', mainCap: '94100', capMin: 94100, capMax: 94100 },
	FM: { capoluogo: 'Fermo', province: 'FM', capPrefix: '63', mainCap: '63900', capMin: 63900, capMax: 63900 },
	FE: { capoluogo: 'Ferrara', province: 'FE', capPrefix: '44', mainCap: '44121', capMin: 44121, capMax: 44124 },
	FI: { capoluogo: 'Firenze', province: 'FI', capPrefix: '50', mainCap: '50121', capMin: 50121, capMax: 50145 },
	FG: { capoluogo: 'Foggia', province: 'FG', capPrefix: '71', mainCap: '71121', capMin: 71121, capMax: 71122 },
	FC: { capoluogo: 'Forlì', province: 'FC', capPrefix: '47', mainCap: '47121', capMin: 47121, capMax: 47122 },
	FR: { capoluogo: 'Frosinone', province: 'FR', capPrefix: '03', mainCap: '03100', capMin: 3100, capMax: 3100 },
	GE: { capoluogo: 'Genova', province: 'GE', capPrefix: '16', mainCap: '16121', capMin: 16121, capMax: 16167 },
	GO: { capoluogo: 'Gorizia', province: 'GO', capPrefix: '34', mainCap: '34170', capMin: 34170, capMax: 34170 },
	GR: { capoluogo: 'Grosseto', province: 'GR', capPrefix: '58', mainCap: '58100', capMin: 58100, capMax: 58100 },
	IM: { capoluogo: 'Imperia', province: 'IM', capPrefix: '18', mainCap: '18100', capMin: 18100, capMax: 18100 },
	IS: { capoluogo: 'Isernia', province: 'IS', capPrefix: '86', mainCap: '86170', capMin: 86170, capMax: 86170 },
	AQ: { capoluogo: "L'Aquila", province: 'AQ', capPrefix: '67', mainCap: '67100', capMin: 67100, capMax: 67100 },
	SP: { capoluogo: 'La Spezia', province: 'SP', capPrefix: '19', mainCap: '19121', capMin: 19121, capMax: 19126 },
	LT: { capoluogo: 'Latina', province: 'LT', capPrefix: '04', mainCap: '04100', capMin: 4100, capMax: 4100 },
	LE: { capoluogo: 'Lecce', province: 'LE', capPrefix: '73', mainCap: '73100', capMin: 73100, capMax: 73100 },
	LC: { capoluogo: 'Lecco', province: 'LC', capPrefix: '23', mainCap: '23900', capMin: 23900, capMax: 23900 },
	LI: { capoluogo: 'Livorno', province: 'LI', capPrefix: '57', mainCap: '57121', capMin: 57121, capMax: 57128 },
	LO: { capoluogo: 'Lodi', province: 'LO', capPrefix: '26', mainCap: '26900', capMin: 26900, capMax: 26900 },
	LU: { capoluogo: 'Lucca', province: 'LU', capPrefix: '55', mainCap: '55100', capMin: 55100, capMax: 55100 },
	MC: { capoluogo: 'Macerata', province: 'MC', capPrefix: '62', mainCap: '62100', capMin: 62100, capMax: 62100 },
	MN: { capoluogo: 'Mantova', province: 'MN', capPrefix: '46', mainCap: '46100', capMin: 46100, capMax: 46100 },
	MS: { capoluogo: 'Massa', province: 'MS', capPrefix: '54', mainCap: '54100', capMin: 54100, capMax: 54100 },
	MT: { capoluogo: 'Matera', province: 'MT', capPrefix: '75', mainCap: '75100', capMin: 75100, capMax: 75100 },
	ME: { capoluogo: 'Messina', province: 'ME', capPrefix: '98', mainCap: '98121', capMin: 98121, capMax: 98168 },
	MI: { capoluogo: 'Milano', province: 'MI', capPrefix: '20', mainCap: '20121', capMin: 20121, capMax: 20162 },
	MO: { capoluogo: 'Modena', province: 'MO', capPrefix: '41', mainCap: '41121', capMin: 41121, capMax: 41126 },
	MB: { capoluogo: 'Monza', province: 'MB', capPrefix: '20', mainCap: '20900', capMin: 20900, capMax: 20900 },
	NA: { capoluogo: 'Napoli', province: 'NA', capPrefix: '80', mainCap: '80121', capMin: 80121, capMax: 80147 },
	NO: { capoluogo: 'Novara', province: 'NO', capPrefix: '28', mainCap: '28100', capMin: 28100, capMax: 28100 },
	NU: { capoluogo: 'Nuoro', province: 'NU', capPrefix: '08', mainCap: '08100', capMin: 8100, capMax: 8100 },
	OR: { capoluogo: 'Oristano', province: 'OR', capPrefix: '09', mainCap: '09170', capMin: 9170, capMax: 9170 },
	PD: { capoluogo: 'Padova', province: 'PD', capPrefix: '35', mainCap: '35121', capMin: 35121, capMax: 35143 },
	PA: { capoluogo: 'Palermo', province: 'PA', capPrefix: '90', mainCap: '90121', capMin: 90121, capMax: 90151 },
	PR: { capoluogo: 'Parma', province: 'PR', capPrefix: '43', mainCap: '43121', capMin: 43121, capMax: 43126 },
	PV: { capoluogo: 'Pavia', province: 'PV', capPrefix: '27', mainCap: '27100', capMin: 27100, capMax: 27100 },
	PG: { capoluogo: 'Perugia', province: 'PG', capPrefix: '06', mainCap: '06121', capMin: 6121, capMax: 6135 },
	PU: { capoluogo: 'Pesaro', province: 'PU', capPrefix: '61', mainCap: '61121', capMin: 61121, capMax: 61122 },
	PE: { capoluogo: 'Pescara', province: 'PE', capPrefix: '65', mainCap: '65121', capMin: 65121, capMax: 65129 },
	PC: { capoluogo: 'Piacenza', province: 'PC', capPrefix: '29', mainCap: '29121', capMin: 29121, capMax: 29122 },
	PI: { capoluogo: 'Pisa', province: 'PI', capPrefix: '56', mainCap: '56121', capMin: 56121, capMax: 56128 },
	PT: { capoluogo: 'Pistoia', province: 'PT', capPrefix: '51', mainCap: '51100', capMin: 51100, capMax: 51100 },
	PN: { capoluogo: 'Pordenone', province: 'PN', capPrefix: '33', mainCap: '33170', capMin: 33170, capMax: 33170 },
	PZ: { capoluogo: 'Potenza', province: 'PZ', capPrefix: '85', mainCap: '85100', capMin: 85100, capMax: 85100 },
	PO: { capoluogo: 'Prato', province: 'PO', capPrefix: '59', mainCap: '59100', capMin: 59100, capMax: 59100 },
	RG: { capoluogo: 'Ragusa', province: 'RG', capPrefix: '97', mainCap: '97100', capMin: 97100, capMax: 97100 },
	RA: { capoluogo: 'Ravenna', province: 'RA', capPrefix: '48', mainCap: '48121', capMin: 48121, capMax: 48125 },
	RC: { capoluogo: 'Reggio Calabria', province: 'RC', capPrefix: '89', mainCap: '89121', capMin: 89121, capMax: 89135 },
	RE: { capoluogo: 'Reggio Emilia', province: 'RE', capPrefix: '42', mainCap: '42121', capMin: 42121, capMax: 42124 },
	RI: { capoluogo: 'Rieti', province: 'RI', capPrefix: '02', mainCap: '02100', capMin: 2100, capMax: 2100 },
	RN: { capoluogo: 'Rimini', province: 'RN', capPrefix: '47', mainCap: '47921', capMin: 47921, capMax: 47924 },
	RM: { capoluogo: 'Roma', province: 'RM', capPrefix: '00', mainCap: '00118', capMin: 100, capMax: 199 },
	RO: { capoluogo: 'Rovigo', province: 'RO', capPrefix: '45', mainCap: '45100', capMin: 45100, capMax: 45100 },
	SA: { capoluogo: 'Salerno', province: 'SA', capPrefix: '84', mainCap: '84121', capMin: 84121, capMax: 84135 },
	SS: { capoluogo: 'Sassari', province: 'SS', capPrefix: '07', mainCap: '07100', capMin: 7100, capMax: 7100 },
	SV: { capoluogo: 'Savona', province: 'SV', capPrefix: '17', mainCap: '17100', capMin: 17100, capMax: 17100 },
	SI: { capoluogo: 'Siena', province: 'SI', capPrefix: '53', mainCap: '53100', capMin: 53100, capMax: 53100 },
	SR: { capoluogo: 'Siracusa', province: 'SR', capPrefix: '96', mainCap: '96100', capMin: 96100, capMax: 96100 },
	SO: { capoluogo: 'Sondrio', province: 'SO', capPrefix: '23', mainCap: '23100', capMin: 23100, capMax: 23100 },
	SU: { capoluogo: 'Carbonia', province: 'SU', capPrefix: '09', mainCap: '09013', capMin: 9013, capMax: 9013 },
	TA: { capoluogo: 'Taranto', province: 'TA', capPrefix: '74', mainCap: '74121', capMin: 74121, capMax: 74123 },
	TE: { capoluogo: 'Teramo', province: 'TE', capPrefix: '64', mainCap: '64100', capMin: 64100, capMax: 64100 },
	TR: { capoluogo: 'Terni', province: 'TR', capPrefix: '05', mainCap: '05100', capMin: 5100, capMax: 5100 },
	TO: { capoluogo: 'Torino', province: 'TO', capPrefix: '10', mainCap: '10121', capMin: 10121, capMax: 10156 },
	TP: { capoluogo: 'Trapani', province: 'TP', capPrefix: '91', mainCap: '91100', capMin: 91100, capMax: 91100 },
	TN: { capoluogo: 'Trento', province: 'TN', capPrefix: '38', mainCap: '38121', capMin: 38121, capMax: 38123 },
	TV: { capoluogo: 'Treviso', province: 'TV', capPrefix: '31', mainCap: '31100', capMin: 31100, capMax: 31100 },
	TS: { capoluogo: 'Trieste', province: 'TS', capPrefix: '34', mainCap: '34121', capMin: 34121, capMax: 34151 },
	UD: { capoluogo: 'Udine', province: 'UD', capPrefix: '33', mainCap: '33100', capMin: 33100, capMax: 33100 },
	VA: { capoluogo: 'Varese', province: 'VA', capPrefix: '21', mainCap: '21100', capMin: 21100, capMax: 21100 },
	VE: { capoluogo: 'Venezia', province: 'VE', capPrefix: '30', mainCap: '30121', capMin: 30121, capMax: 30176 },
	VB: { capoluogo: 'Verbania', province: 'VB', capPrefix: '28', mainCap: '28921', capMin: 28921, capMax: 28925 },
	VC: { capoluogo: 'Vercelli', province: 'VC', capPrefix: '13', mainCap: '13100', capMin: 13100, capMax: 13100 },
	VR: { capoluogo: 'Verona', province: 'VR', capPrefix: '37', mainCap: '37121', capMin: 37121, capMax: 37142 },
	VV: { capoluogo: 'Vibo Valentia', province: 'VV', capPrefix: '89', mainCap: '89900', capMin: 89900, capMax: 89900 },
	VI: { capoluogo: 'Vicenza', province: 'VI', capPrefix: '36', mainCap: '36100', capMin: 36100, capMax: 36100 },
	VT: { capoluogo: 'Viterbo', province: 'VT', capPrefix: '01', mainCap: '01100', capMin: 1100, capMax: 1100 }
};

/**
 * Normalize city name for comparison
 */
function normalizeCityName(city: string): string {
	if (!city) return '';
	return city
		.toUpperCase()
		.trim()
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '') // Remove accents
		.replace(/[''`]/g, "'");
}

/**
 * Check if a CAP belongs to a provincial capital
 *
 * @param cap - The postal code (CAP)
 * @param province - The province code (2 letters)
 * @returns The city name if it's a capoluogo, null otherwise
 */
export function getCityFromCap(cap: string, province: string): string | null {
	if (!cap || !province) return null;

	const normalizedCap = cap.replace(/\D/g, '').padStart(5, '0');
	const capNum = parseInt(normalizedCap, 10);
	const upperProvince = province.toUpperCase().trim();

	const provinceInfo = PROVINCE_CAP_INFO[upperProvince];
	if (!provinceInfo) return null;

	// Check if CAP is in the capoluogo range
	if (capNum >= provinceInfo.capMin && capNum <= provinceInfo.capMax) {
		return provinceInfo.capoluogo;
	}

	// Special case for large cities with extended CAP ranges
	// Milano: 20100-20199
	if (upperProvince === 'MI' && capNum >= 20100 && capNum <= 20199) {
		return 'Milano';
	}

	// Roma: 00100-00199
	if (upperProvince === 'RM' && capNum >= 100 && capNum <= 199) {
		return 'Roma';
	}

	// Napoli: 80100-80147
	if (upperProvince === 'NA' && capNum >= 80100 && capNum <= 80147) {
		return 'Napoli';
	}

	// Torino: 10100-10156
	if (upperProvince === 'TO' && capNum >= 10100 && capNum <= 10156) {
		return 'Torino';
	}

	// Genova: 16100-16167
	if (upperProvince === 'GE' && capNum >= 16100 && capNum <= 16167) {
		return 'Genova';
	}

	// Bologna: 40100-40141
	if (upperProvince === 'BO' && capNum >= 40100 && capNum <= 40141) {
		return 'Bologna';
	}

	// Firenze: 50100-50145
	if (upperProvince === 'FI' && capNum >= 50100 && capNum <= 50145) {
		return 'Firenze';
	}

	// Venezia: 30100-30176
	if (upperProvince === 'VE' && capNum >= 30100 && capNum <= 30176) {
		return 'Venezia';
	}

	// Palermo: 90100-90151
	if (upperProvince === 'PA' && capNum >= 90100 && capNum <= 90151) {
		return 'Palermo';
	}

	// Catania: 95100-95131
	if (upperProvince === 'CT' && capNum >= 95100 && capNum <= 95131) {
		return 'Catania';
	}

	// Bari: 70100-70132
	if (upperProvince === 'BA' && capNum >= 70100 && capNum <= 70132) {
		return 'Bari';
	}

	return null;
}

/**
 * Get the main CAP for a city (if it's a capoluogo)
 *
 * @param city - The city name
 * @param province - The province code (2 letters)
 * @returns The main CAP if found, null otherwise
 */
export function getCapFromCity(city: string, province: string): string | null {
	if (!city || !province) return null;

	const normalizedCity = normalizeCityName(city);
	const upperProvince = province.toUpperCase().trim();

	const provinceInfo = PROVINCE_CAP_INFO[upperProvince];
	if (!provinceInfo) return null;

	// Check if the city matches the capoluogo
	const normalizedCapoluogo = normalizeCityName(provinceInfo.capoluogo);

	if (normalizedCity === normalizedCapoluogo) {
		return provinceInfo.mainCap;
	}

	// Check common variations
	// Milano can also be "Milan"
	if (upperProvince === 'MI' && (normalizedCity === 'MILAN' || normalizedCity === 'MILANO')) {
		return '20121';
	}

	// Roma can also be "Rome"
	if (upperProvince === 'RM' && (normalizedCity === 'ROME' || normalizedCity === 'ROMA')) {
		return '00118';
	}

	// Napoli can also be "Naples"
	if (upperProvince === 'NA' && (normalizedCity === 'NAPLES' || normalizedCity === 'NAPOLI')) {
		return '80121';
	}

	// Firenze can also be "Florence"
	if (upperProvince === 'FI' && (normalizedCity === 'FLORENCE' || normalizedCity === 'FIRENZE')) {
		return '50121';
	}

	// Torino can also be "Turin"
	if (upperProvince === 'TO' && (normalizedCity === 'TURIN' || normalizedCity === 'TORINO')) {
		return '10121';
	}

	// Venezia can also be "Venice"
	if (upperProvince === 'VE' && (normalizedCity === 'VENICE' || normalizedCity === 'VENEZIA')) {
		return '30121';
	}

	// Genova can also be "Genoa"
	if (upperProvince === 'GE' && (normalizedCity === 'GENOA' || normalizedCity === 'GENOVA')) {
		return '16121';
	}

	return null;
}

/**
 * Check if a CAP is valid for a given province
 *
 * @param cap - The postal code (CAP)
 * @param province - The province code (2 letters)
 * @returns true if the CAP prefix matches the province
 */
export function isCapValidForProvince(cap: string, province: string): boolean {
	if (!cap || !province) return false;

	const normalizedCap = cap.replace(/\D/g, '').padStart(5, '0');
	const upperProvince = province.toUpperCase().trim();

	const provinceInfo = PROVINCE_CAP_INFO[upperProvince];
	if (!provinceInfo) return false;

	// Check if CAP starts with the expected prefix
	return normalizedCap.startsWith(provinceInfo.capPrefix);
}
