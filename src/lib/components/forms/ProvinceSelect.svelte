<script lang="ts">
	import Listbox from './Listbox.svelte';

	interface Props {
		name: string;
		label: string;
		value?: string;
		error?: string;
		required?: boolean;
		disabled?: boolean;
		onchange?: (value: string) => void;
		onblur?: (value: string) => void;
	}

	let {
		name,
		label,
		value = '',
		error,
		required = false,
		disabled = false,
		onchange,
		onblur
	}: Props = $props();

	// All Italian provinces with codes
	const provinces = [
		{ value: 'AG', label: 'Agrigento (AG)' },
		{ value: 'AL', label: 'Alessandria (AL)' },
		{ value: 'AN', label: 'Ancona (AN)' },
		{ value: 'AO', label: 'Aosta (AO)' },
		{ value: 'AR', label: 'Arezzo (AR)' },
		{ value: 'AP', label: 'Ascoli Piceno (AP)' },
		{ value: 'AT', label: 'Asti (AT)' },
		{ value: 'AV', label: 'Avellino (AV)' },
		{ value: 'BA', label: 'Bari (BA)' },
		{ value: 'BT', label: 'Barletta-Andria-Trani (BT)' },
		{ value: 'BL', label: 'Belluno (BL)' },
		{ value: 'BN', label: 'Benevento (BN)' },
		{ value: 'BG', label: 'Bergamo (BG)' },
		{ value: 'BI', label: 'Biella (BI)' },
		{ value: 'BO', label: 'Bologna (BO)' },
		{ value: 'BZ', label: 'Bolzano (BZ)' },
		{ value: 'BS', label: 'Brescia (BS)' },
		{ value: 'BR', label: 'Brindisi (BR)' },
		{ value: 'CA', label: 'Cagliari (CA)' },
		{ value: 'CL', label: 'Caltanissetta (CL)' },
		{ value: 'CB', label: 'Campobasso (CB)' },
		{ value: 'CE', label: 'Caserta (CE)' },
		{ value: 'CT', label: 'Catania (CT)' },
		{ value: 'CZ', label: 'Catanzaro (CZ)' },
		{ value: 'CH', label: 'Chieti (CH)' },
		{ value: 'CO', label: 'Como (CO)' },
		{ value: 'CS', label: 'Cosenza (CS)' },
		{ value: 'CR', label: 'Cremona (CR)' },
		{ value: 'KR', label: 'Crotone (KR)' },
		{ value: 'CN', label: 'Cuneo (CN)' },
		{ value: 'EN', label: 'Enna (EN)' },
		{ value: 'FM', label: 'Fermo (FM)' },
		{ value: 'FE', label: 'Ferrara (FE)' },
		{ value: 'FI', label: 'Firenze (FI)' },
		{ value: 'FG', label: 'Foggia (FG)' },
		{ value: 'FC', label: 'Forlì-Cesena (FC)' },
		{ value: 'FR', label: 'Frosinone (FR)' },
		{ value: 'GE', label: 'Genova (GE)' },
		{ value: 'GO', label: 'Gorizia (GO)' },
		{ value: 'GR', label: 'Grosseto (GR)' },
		{ value: 'IM', label: 'Imperia (IM)' },
		{ value: 'IS', label: 'Isernia (IS)' },
		{ value: 'AQ', label: "L'Aquila (AQ)" },
		{ value: 'SP', label: 'La Spezia (SP)' },
		{ value: 'LT', label: 'Latina (LT)' },
		{ value: 'LE', label: 'Lecce (LE)' },
		{ value: 'LC', label: 'Lecco (LC)' },
		{ value: 'LI', label: 'Livorno (LI)' },
		{ value: 'LO', label: 'Lodi (LO)' },
		{ value: 'LU', label: 'Lucca (LU)' },
		{ value: 'MC', label: 'Macerata (MC)' },
		{ value: 'MN', label: 'Mantova (MN)' },
		{ value: 'MS', label: 'Massa-Carrara (MS)' },
		{ value: 'MT', label: 'Matera (MT)' },
		{ value: 'ME', label: 'Messina (ME)' },
		{ value: 'MI', label: 'Milano (MI)' },
		{ value: 'MO', label: 'Modena (MO)' },
		{ value: 'MB', label: 'Monza e Brianza (MB)' },
		{ value: 'NA', label: 'Napoli (NA)' },
		{ value: 'NO', label: 'Novara (NO)' },
		{ value: 'NU', label: 'Nuoro (NU)' },
		{ value: 'OR', label: 'Oristano (OR)' },
		{ value: 'PD', label: 'Padova (PD)' },
		{ value: 'PA', label: 'Palermo (PA)' },
		{ value: 'PR', label: 'Parma (PR)' },
		{ value: 'PV', label: 'Pavia (PV)' },
		{ value: 'PG', label: 'Perugia (PG)' },
		{ value: 'PU', label: 'Pesaro e Urbino (PU)' },
		{ value: 'PE', label: 'Pescara (PE)' },
		{ value: 'PC', label: 'Piacenza (PC)' },
		{ value: 'PI', label: 'Pisa (PI)' },
		{ value: 'PT', label: 'Pistoia (PT)' },
		{ value: 'PN', label: 'Pordenone (PN)' },
		{ value: 'PZ', label: 'Potenza (PZ)' },
		{ value: 'PO', label: 'Prato (PO)' },
		{ value: 'RG', label: 'Ragusa (RG)' },
		{ value: 'RA', label: 'Ravenna (RA)' },
		{ value: 'RC', label: 'Reggio Calabria (RC)' },
		{ value: 'RE', label: 'Reggio Emilia (RE)' },
		{ value: 'RI', label: 'Rieti (RI)' },
		{ value: 'RN', label: 'Rimini (RN)' },
		{ value: 'RM', label: 'Roma (RM)' },
		{ value: 'RO', label: 'Rovigo (RO)' },
		{ value: 'SA', label: 'Salerno (SA)' },
		{ value: 'SS', label: 'Sassari (SS)' },
		{ value: 'SV', label: 'Savona (SV)' },
		{ value: 'SI', label: 'Siena (SI)' },
		{ value: 'SR', label: 'Siracusa (SR)' },
		{ value: 'SO', label: 'Sondrio (SO)' },
		{ value: 'SU', label: 'Sud Sardegna (SU)' },
		{ value: 'TA', label: 'Taranto (TA)' },
		{ value: 'TE', label: 'Teramo (TE)' },
		{ value: 'TR', label: 'Terni (TR)' },
		{ value: 'TO', label: 'Torino (TO)' },
		{ value: 'TP', label: 'Trapani (TP)' },
		{ value: 'TN', label: 'Trento (TN)' },
		{ value: 'TV', label: 'Treviso (TV)' },
		{ value: 'TS', label: 'Trieste (TS)' },
		{ value: 'UD', label: 'Udine (UD)' },
		{ value: 'VA', label: 'Varese (VA)' },
		{ value: 'VE', label: 'Venezia (VE)' },
		{ value: 'VB', label: 'Verbano-Cusio-Ossola (VB)' },
		{ value: 'VC', label: 'Vercelli (VC)' },
		{ value: 'VR', label: 'Verona (VR)' },
		{ value: 'VV', label: 'Vibo Valentia (VV)' },
		{ value: 'VI', label: 'Vicenza (VI)' },
		{ value: 'VT', label: 'Viterbo (VT)' }
	];
</script>

<Listbox
	{name}
	{label}
	options={provinces}
	{value}
	{error}
	{required}
	{disabled}
	placeholder="Seleziona provincia..."
	searchable={true}
	searchPlaceholder="Cerca provincia..."
	{onchange}
	{onblur}
/>
