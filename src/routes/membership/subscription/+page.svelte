<script lang="ts">
	import { enhance } from '$app/forms';
	import TextContainer from '$lib/components/TextContainer.svelte';
	import FormCard from '$lib/components/forms/FormCard.svelte';
	import Input from '$lib/components/forms/Input.svelte';
	import Select from '$lib/components/forms/Select.svelte';
	import Checkbox from '$lib/components/forms/Checkbox.svelte';
	import Button from '$lib/components/forms/Button.svelte';
	import ErrorMessage from '$lib/components/forms/ErrorMessage.svelte';
	import AddressAutocomplete, { type AddressResult } from '$lib/components/forms/AddressAutocomplete.svelte';
	import type { PageData } from './$types';

	// Type for profile form errors
	type ProfileFormErrors = {
		_form?: string;
		firstName?: string;
		lastName?: string;
		birthDate?: string;
		nationality?: string;
		birthProvince?: string;
		birthCity?: string;
		hasForeignTaxCode?: string;
		taxCode?: string;
		address?: string;
		city?: string;
		postalCode?: string;
		province?: string;
		phone?: string;
		privacyConsent?: string;
		dataConsent?: string;
	};

	// Type for form values
	type ProfileFormValues = {
		firstName?: string;
		lastName?: string;
		birthDate?: string;
		nationality?: string;
		birthProvince?: string;
		birthCity?: string;
		hasForeignTaxCode?: boolean;
		taxCode?: string;
		address?: string;
		city?: string;
		postalCode?: string;
		province?: string;
		phone?: string;
		privacyConsent?: boolean;
		dataConsent?: boolean;
	};

	type SubscriptionFormData = {
		success?: boolean;
		errors?: ProfileFormErrors;
		values?: ProfileFormValues;
	} | null;

	let { data, form }: { data: PageData; form: SubscriptionFormData } = $props();
	let loading = $state(false);

	// Track nationality for conditional rendering (initialized from form/data, then user-controlled)
	let nationalityOverride = $state<string | null>(null);
	let hasForeignTaxCodeOverride = $state<boolean | null>(null);

	// Address fields (can be populated by autocomplete or manual input)
	let addressOverride = $state<string | null>(null);
	let cityOverride = $state<string | null>(null);
	let postalCodeOverride = $state<string | null>(null);
	let provinceOverride = $state<string | null>(null);

	// Derived values for address fields
	let address = $derived(addressOverride ?? form?.values?.address ?? data.profile?.address ?? '');
	let city = $derived(cityOverride ?? form?.values?.city ?? data.profile?.city ?? '');
	let postalCode = $derived(postalCodeOverride ?? form?.values?.postalCode ?? data.profile?.postalCode ?? '');
	let province = $derived(provinceOverride ?? form?.values?.province ?? data.profile?.province ?? '');

	// Handle address selection from autocomplete
	function handleAddressSelect(result: AddressResult) {
		addressOverride = result.address;
		cityOverride = result.city;
		postalCodeOverride = result.postalCode;
		provinceOverride = result.province;
	}

	// Use override if set, otherwise fall back to form/data values
	let nationality = $derived(
		nationalityOverride ?? form?.values?.nationality ?? data.profile?.nationality ?? ''
	);
	let hasForeignTaxCode = $derived(
		hasForeignTaxCodeOverride ?? form?.values?.hasForeignTaxCode ?? data.profile?.hasForeignTaxCode ?? false
	);

	// Computed states
	let isItalian = $derived(nationality === 'IT');
	let showTaxCodeField = $derived(isItalian || hasForeignTaxCode);

	// Nationality options
	const nationalityOptions = [
		{ value: 'IT', label: 'Italiana' },
		{ value: 'XX', label: 'Estera' }
	];

	// Italian provinces for birth
	const provinceOptions = [
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
		{ value: 'FC', label: 'Forli-Cesena (FC)' },
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

	// Format birth date for input
	function formatDateForInput(date: Date | string | null | undefined): string {
		if (!date) return '';
		const d = typeof date === 'string' ? new Date(date) : date;
		if (isNaN(d.getTime())) return '';
		return d.toISOString().split('T')[0];
	}
</script>

<div class="bg-dopoRed min-h-screen flex items-center justify-center px-4 py-16">
	<TextContainer maxWidth="max-w-2xl">
		<h1 class="text-4xl md:text-5xl font-bold mb-4">Iscrizione</h1>
		<p class="text-xl mb-8">Bentornato, {data.user.email}</p>

		{#if form?.success}
			<div class="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-6">
				Profilo salvato con successo!
			</div>
		{/if}

		<form
			method="POST"
			use:enhance={() => {
				loading = true;
				return async ({ update }) => {
					await update({ invalidateAll: true, reset: false });
					loading = false;
				};
			}}
		>
			<!-- Dati Personali -->
			<FormCard title="Dati Personali">
				{#if form?.errors?._form}
					<ErrorMessage>{form.errors._form}</ErrorMessage>
				{/if}

				<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
					<Input
						name="firstName"
						label="Nome"
						type="text"
						value={form?.values?.firstName || data.profile?.firstName || ''}
						error={form?.errors?.firstName}
						required
						placeholder="Mario"
					/>

					<Input
						name="lastName"
						label="Cognome"
						type="text"
						value={form?.values?.lastName || data.profile?.lastName || ''}
						error={form?.errors?.lastName}
						required
						placeholder="Rossi"
					/>
				</div>
			</FormCard>

			<!-- Dati di Nascita -->
			<FormCard title="Dati di Nascita">
				<Input
					name="birthDate"
					label="Data di Nascita"
					type="date"
					value={form?.values?.birthDate || formatDateForInput(data.profile?.birthDate)}
					error={form?.errors?.birthDate}
					required
				/>

				<Select
					name="nationality"
					label="Nazionalita"
					options={nationalityOptions}
					value={nationality}
					error={form?.errors?.nationality}
					required
					onchange={(value) => nationalityOverride = value}
				/>

				{#if isItalian}
					<Select
						name="birthProvince"
						label="Provincia di Nascita"
						options={provinceOptions}
						value={form?.values?.birthProvince || data.profile?.birthProvince || ''}
						error={form?.errors?.birthProvince}
						required
					/>

					<Input
						name="birthCity"
						label="Comune di Nascita"
						type="text"
						value={form?.values?.birthCity || data.profile?.birthCity || ''}
						error={form?.errors?.birthCity}
						required
						placeholder="Milano"
					/>
				{:else if nationality}
					<!-- For foreigners: EE province and country of origin -->
					<input type="hidden" name="birthProvince" value="EE" />
					<div class="mb-6">
						<label for="birthProvinceDisabled" class="label text-gray-700">Provincia di Nascita</label>
						<input
							type="text"
							id="birthProvinceDisabled"
							value="EE (Estero)"
							disabled
							class="input text-gray-500 bg-gray-100"
						/>
					</div>

					<Input
						name="birthCity"
						label="Paese di Origine"
						type="text"
						value={form?.values?.birthCity || data.profile?.birthCity || ''}
						error={form?.errors?.birthCity}
						required
						placeholder="es. Germania, Francia, Romania..."
					/>
				{/if}
			</FormCard>

			<!-- Codice Fiscale -->
			<FormCard title="Codice Fiscale">
				{#if !isItalian && nationality}
					<Checkbox
						name="hasForeignTaxCode"
						label="Ho un Codice Fiscale italiano"
						checked={hasForeignTaxCode}
						onchange={(checked) => hasForeignTaxCodeOverride = checked}
					/>
				{/if}

				{#if showTaxCodeField}
					<Input
						name="taxCode"
						label="Codice Fiscale"
						type="text"
						value={form?.values?.taxCode || data.profile?.taxCode || ''}
						error={form?.errors?.taxCode}
						required={isItalian}
						placeholder="RSSMRA85M10H501S"
					/>
					<p class="text-sm text-gray-600 -mt-4 mb-6">
						Il codice fiscale deve corrispondere alla data di nascita inserita.
					</p>
				{:else if nationality}
					<p class="text-gray-600 mb-4">
						Non hai un Codice Fiscale italiano? Nessun problema!
						Inseriremo automaticamente un codice generico per la registrazione AICS.
					</p>
					<input type="hidden" name="taxCode" value="" />
				{/if}
			</FormCard>

			<!-- Residenza -->
			<FormCard title="Residenza">
				<AddressAutocomplete
					label="Cerca indirizzo"
					placeholder="Inizia a digitare un indirizzo..."
					onselect={handleAddressSelect}
				/>

				<Input
					name="address"
					label="Indirizzo"
					type="text"
					value={address}
					error={form?.errors?.address}
					required
					placeholder="Via Roma, 1"
				/>

				<div class="grid grid-cols-1 md:grid-cols-3 gap-4">
					<Input
						name="postalCode"
						label="CAP"
						type="text"
						value={postalCode}
						error={form?.errors?.postalCode}
						required
						placeholder="20100"
						maxlength={5}
					/>

					<Input
						name="province"
						label="Provincia"
						type="text"
						value={province}
						error={form?.errors?.province}
						required
						placeholder="MI"
						maxlength={2}
					/>

					<Input
						name="city"
						label="Comune"
						type="text"
						value={city}
						error={form?.errors?.city}
						required
						placeholder="Milano"
					/>
				</div>
			</FormCard>

			<!-- Contatti -->
			<FormCard title="Contatti">
				<div class="mb-6">
					<label for="emailDisabled" class="label text-gray-700">Email</label>
					<input
						type="email"
						id="emailDisabled"
						value={data.user.email}
						disabled
						class="input text-gray-500 bg-gray-100"
					/>
					<p class="text-sm text-gray-600 mt-1">L'email non puo essere modificata.</p>
				</div>

				<Input
					name="phone"
					label="Cellulare (opzionale)"
					type="tel"
					value={form?.values?.phone || data.profile?.phone || ''}
					error={form?.errors?.phone}
					placeholder="+39 333 1234567"
				/>
			</FormCard>

			<!-- Consensi -->
			<FormCard title="Consensi">
				<Checkbox
					name="privacyConsent"
					label="Ho letto e accetto la Privacy Policy"
					checked={form?.values?.privacyConsent || data.profile?.privacyConsent || false}
					error={form?.errors?.privacyConsent}
					required
				/>

				<Checkbox
					name="dataConsent"
					label="Acconsento al trattamento dei miei dati personali per le finalita descritte"
					checked={form?.values?.dataConsent || data.profile?.dataConsent || false}
					error={form?.errors?.dataConsent}
					required
				/>
			</FormCard>

			<div class="mt-6">
				<Button type="submit" variant="primary" {loading} fullWidth>
					{loading ? 'Salvataggio...' : 'Salva e Continua'}
				</Button>
			</div>
		</form>

		<div class="mt-6 text-center">
			<a href="/" class="underline hover:no-underline">Torna alla home</a>
		</div>
	</TextContainer>
</div>

