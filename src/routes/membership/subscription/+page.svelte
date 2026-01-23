<script lang="ts">
	import { enhance } from '$app/forms';
	import FormCard from '$lib/components/forms/FormCard.svelte';
	import Input from '$lib/components/forms/Input.svelte';
	import Listbox from '$lib/components/forms/Listbox.svelte';
	import Checkbox from '$lib/components/forms/Checkbox.svelte';
	import Button from '$lib/components/forms/Button.svelte';
	import ErrorMessage from '$lib/components/forms/ErrorMessage.svelte';
	import AddressAutocomplete, { type AddressResult } from '$lib/components/forms/AddressAutocomplete.svelte';
	import PhoneInput from '$lib/components/forms/PhoneInput.svelte';
	import ProvinceSelect from '$lib/components/forms/ProvinceSelect.svelte';
	import WelcomeHeader from '$lib/components/forms/WelcomeHeader.svelte';
	import ConsentSection from '$lib/components/forms/ConsentSection.svelte';
	import Toast from '$lib/components/Toast.svelte';
	import { validateField, type ValidationContext } from '$lib/utils/form-validation';
	import { calculateAge } from '$lib/utils/date';
	import { SystemState } from '$lib/types/membership';
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
		gender?: string;
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
		gender?: string;
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
	let showSuccessToast = $state(false);
	let showErrorToast = $state(false);

	// Form is collapsed by default if profile is already complete
	let formExpanded = $state(!data.profileComplete);

	// Show toast when form submission succeeds or fails
	$effect(() => {
		if (form?.success) {
			showSuccessToast = true;
			showErrorToast = false;
		} else if (form?.errors) {
			showErrorToast = true;
			showSuccessToast = false;
		}
	});

	// Client-side validation errors (separate from server-side form errors)
	let clientErrors = $state<ProfileFormErrors>({});

	// Track nationality for conditional rendering (initialized from form/data, then user-controlled)
	let nationalityOverride = $state<string | null>(null);
	let hasForeignTaxCodeOverride = $state<boolean | null>(null);
	let genderOverride = $state<string | null>(null);

	// Address fields (can be populated by autocomplete or manual input)
	let addressOverride = $state<string | null>(null);
	let cityOverride = $state<string | null>(null);
	let postalCodeOverride = $state<string | null>(null);
	let provinceOverride = $state<string | null>(null);
	let residenceCountryOverride = $state<string | null>(null);

	// Birth city/province fields (can be populated by autocomplete)
	let birthCityOverride = $state<string | null>(null);
	let birthProvinceOverride = $state<string | null>(null);

	// Track birth date for validation context
	let birthDateOverride = $state<string | null>(null);

	// Derived values for address fields
	let address = $derived(addressOverride ?? form?.values?.address ?? data.profile?.address ?? '');
	let city = $derived(cityOverride ?? form?.values?.city ?? data.profile?.city ?? '');
	let postalCode = $derived(postalCodeOverride ?? form?.values?.postalCode ?? data.profile?.postalCode ?? '');
	let residenceCountry = $derived(residenceCountryOverride ?? data.profile?.residenceCountry ?? 'IT');

	// Province: use "EE" for foreign residence, otherwise use the selected province
	let isForeignResidence = $derived(residenceCountry !== 'IT');
	let province = $derived(
		isForeignResidence
			? 'EE'
			: (provinceOverride ?? form?.values?.province ?? data.profile?.province ?? '')
	);

	// Derived values for birth city/province/date fields
	let birthCity = $derived(birthCityOverride ?? form?.values?.birthCity ?? data.profile?.birthCity ?? '');
	let birthProvince = $derived(birthProvinceOverride ?? form?.values?.birthProvince ?? data.profile?.birthProvince ?? '');
	let birthDate = $derived(birthDateOverride ?? form?.values?.birthDate ?? formatDateForInput(data.profile?.birthDate));

	// Handle address selection from autocomplete
	// Always update all fields when user selects from autocomplete
	function handleAddressSelect(result: AddressResult) {
		// Always update address (the main field)
		addressOverride = result.address;
		// Update other fields - use result value or preserve existing if empty
		if (result.city) cityOverride = result.city;
		if (result.postalCode) postalCodeOverride = result.postalCode;
		// Update country (default to IT if not provided)
		residenceCountryOverride = result.countryCode || 'IT';
		// Only update province if residence is in Italy
		if (result.countryCode === 'IT' && result.province) {
			provinceOverride = result.province;
		}
	}

	// Handle birth city selection from autocomplete
	function handleBirthCitySelect(result: AddressResult) {
		if (result.city) birthCityOverride = result.city;
		if (result.province) birthProvinceOverride = result.province;
	}

	// Handle nationality change - clear birth city when nationality changes
	function handleNationalityChange(value: string) {
		nationalityOverride = value;
		// Clear birth city and province when nationality changes
		birthCityOverride = '';
		birthProvinceOverride = '';
	}

	// Use override if set, otherwise fall back to form/data values
	let nationality = $derived(
		nationalityOverride ?? form?.values?.nationality ?? data.profile?.nationality ?? ''
	);
	let hasForeignTaxCode = $derived(
		hasForeignTaxCodeOverride ?? form?.values?.hasForeignTaxCode ?? data.profile?.hasForeignTaxCode ?? false
	);
	let gender = $derived(
		genderOverride ?? form?.values?.gender ?? data.profile?.gender ?? ''
	);

	// Check if user is under 16
	let isUnder16 = $derived(calculateAge(birthDate) < 16);

	// Computed states
	let isItalian = $derived(nationality === 'IT');
	let isForeigner = $derived(nationality === 'XX');
	// Show tax code: always by default, or if Italian, or if foreigner with Italian tax code
	let showTaxCodeField = $derived(!isForeigner || hasForeignTaxCode);
	// Show gender field: only for foreigners without tax code (since it cannot be derived from CF)
	let showGenderField = $derived(isForeigner && !hasForeignTaxCode);

	// Build validation context from current form state
	let validationContext = $derived<ValidationContext>({
		nationality,
		hasForeignTaxCode,
		residenceCountry,
		birthDate
	});

	// Handle field blur validation
	function handleFieldBlur(fieldName: keyof ProfileFormErrors, value: string) {
		const result = validateField(fieldName, value, validationContext);
		if (!result.valid && result.error) {
			clientErrors[fieldName] = result.error;
		} else {
			delete clientErrors[fieldName];
			// Force reactivity by reassigning
			clientErrors = { ...clientErrors };
		}
	}

	// Handle checkbox blur validation
	function handleCheckboxBlur(fieldName: keyof ProfileFormErrors, checked: boolean) {
		const result = validateField(fieldName, checked ? 'true' : '', validationContext);
		if (!result.valid && result.error) {
			clientErrors[fieldName] = result.error;
		} else {
			delete clientErrors[fieldName];
			clientErrors = { ...clientErrors };
		}
	}

	// Get error for a field (prefer server-side error, fall back to client-side)
	function getFieldError(fieldName: keyof ProfileFormErrors): string | undefined {
		return form?.errors?.[fieldName] ?? clientErrors[fieldName];
	}

	// Nationality options
	const nationalityOptions = [
		{ value: 'IT', label: 'Italiana' },
		{ value: 'XX', label: 'Estera' }
	];

	// Gender options
	const genderOptions = [
		{ value: 'M', label: 'Maschio' },
		{ value: 'F', label: 'Femmina' }
	];

	// Country names for display
	const countryNames: Record<string, string> = {
		IT: 'Italia',
		DE: 'Germania',
		FR: 'Francia',
		ES: 'Spagna',
		UK: 'Regno Unito',
		US: 'Stati Uniti',
		CH: 'Svizzera',
		AT: 'Austria',
		BE: 'Belgio',
		NL: 'Paesi Bassi',
		PT: 'Portogallo',
		PL: 'Polonia',
		RO: 'Romania'
	};

	// Get country name from code
	function getCountryName(code: string): string {
		return countryNames[code] || code;
	}

	// Format birth date for input
	function formatDateForInput(date: Date | string | null | undefined): string {
		if (!date) return '';
		const d = typeof date === 'string' ? new Date(date) : date;
		if (isNaN(d.getTime())) return '';
		return d.toISOString().split('T')[0];
	}

</script>

{#snippet headerSubtitle()}
	{#if data.membershipState === SystemState.S0_NO_MEMBERSHIP}
		Completa il tuo profilo per attivare la tessera
	{:else if data.membershipState === SystemState.S1_PROFILE_COMPLETE}
		Profilo completo! <a href="/membership/checkout">Procedi al pagamento</a>
	{:else if data.membershipState === SystemState.S2_PROCESSING_PAYMENT}
		Pagamento in corso...
	{:else if data.membershipState === SystemState.S3_PAYMENT_FAILED}
		Il pagamento non è andato a buon fine. <a href="/membership/checkout">Riprova</a>
	{:else if data.membershipState === SystemState.S4_AWAITING_NUMBER}
		Pagamento completato! In attesa di assegnazione tessera
	{:else if data.membershipState === SystemState.S5_ACTIVE}
		La tua tessera è attiva
	{:else if data.membershipState === SystemState.S6_EXPIRED}
		La tua tessera è scaduta. <a href="/membership/checkout">Rinnova ora</a>
	{:else if data.membershipState === SystemState.S7_CANCELED}
		La tua tessera è stata cancellata
	{:else}
		Completa il tuo profilo per attivare la tessera
	{/if}
{/snippet}

<div class="subscription-page">
	<div class="form-container">
		<!-- Welcome Header -->
		<WelcomeHeader
			title="Iscrizione"
			subtitleSnippet={headerSubtitle}
			email={data.user.email}
			showEmail={false}
		/>

		<!-- Membership Status Cards -->
		{#if data.membershipState === SystemState.S4_AWAITING_NUMBER}
			<FormCard title="Pagamento completato" icon="check">
				<div class="status-card success">
					<div class="status-icon-wrapper">
						<svg class="status-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
						</svg>
					</div>
					<div class="status-content">
						<h3 class="status-title">Il tuo pagamento è stato ricevuto!</h3>
						<p class="status-text">Ti assegneremo un numero tessera a breve. Riceverai un'email di conferma.</p>
					</div>
				</div>
			</FormCard>
		{:else if data.membershipState === SystemState.S5_ACTIVE}
			<FormCard title="Tessera attiva" icon="check">
				<div class="status-card success">
					<div class="status-icon-wrapper">
						<svg class="status-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
						</svg>
					</div>
					<div class="status-content">
						<h3 class="status-title">La tua tessera è attiva!</h3>
						{#if data.membershipNumber}
							<p class="status-number">Numero tessera: <strong>{data.membershipNumber}</strong></p>
						{/if}
						<p class="status-text">Benvenuto nella community di Dopo Space!</p>
					</div>
				</div>
			</FormCard>
		{:else if data.membershipState === SystemState.S3_PAYMENT_FAILED}
			<FormCard title="Pagamento non riuscito" icon="alert">
				<div class="status-card warning">
					<div class="status-icon-wrapper">
						<svg class="status-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
						</svg>
					</div>
					<div class="status-content">
						<h3 class="status-title">Il pagamento precedente non è andato a buon fine</h3>
						<p class="status-text">Verifica i tuoi dati e riprova il pagamento.</p>
						<a href="/membership/checkout" class="status-cta">Riprova il pagamento</a>
					</div>
				</div>
			</FormCard>
		{:else if data.membershipState === SystemState.S6_EXPIRED}
			<FormCard title="Tessera scaduta" icon="alert">
				<div class="status-card warning">
					<div class="status-icon-wrapper">
						<svg class="status-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
						</svg>
					</div>
					<div class="status-content">
						<h3 class="status-title">La tua tessera è scaduta</h3>
						<p class="status-text">Rinnova la tessera per continuare a far parte della community.</p>
						<a href="/membership/checkout" class="status-cta">Rinnova ora</a>
					</div>
				</div>
			</FormCard>
		{/if}

		<!-- Collapsible Profile Section (only collapsible if profile is already complete) -->
		{#if data.profileComplete}
			<button
				type="button"
				class="profile-toggle"
				onclick={() => formExpanded = !formExpanded}
			>
				<div class="profile-toggle-content">
					<svg class="profile-toggle-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
					</svg>
					<div class="profile-toggle-text">
						<span class="profile-toggle-title">I tuoi dati</span>
						<span class="profile-toggle-subtitle">
							{data.profile?.firstName} {data.profile?.lastName}
						</span>
					</div>
				</div>
				<svg
					class="profile-toggle-chevron {formExpanded ? 'expanded' : ''}"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
					stroke-width="2"
				>
					<path stroke-linecap="round" stroke-linejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
				</svg>
			</button>
		{/if}

		{#if formExpanded || !data.profileComplete}
		<form
			method="POST"
			use:enhance={() => {
				loading = true;
				// Clear client-side errors on submit (server will re-validate)
				clientErrors = {};
				return async ({ update }) => {
					await update({ invalidateAll: true, reset: false });
					loading = false;
				};
			}}
		>
			<!-- Dati Personali -->
			<FormCard title="Dati Personali" icon="user" subtitle="Nome e cognome come da documento">
				{#if form?.errors?._form}
					<ErrorMessage>{form.errors._form}</ErrorMessage>
				{/if}

				<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
					<Input
						name="firstName"
						label="Nome"
						type="text"
						value={form?.values?.firstName || data.profile?.firstName || ''}
						error={getFieldError('firstName')}
						required
						placeholder="Mario"
						onblur={(value) => handleFieldBlur('firstName', value)}
					/>

					<Input
						name="lastName"
						label="Cognome"
						type="text"
						value={form?.values?.lastName || data.profile?.lastName || ''}
						error={getFieldError('lastName')}
						required
						placeholder="Rossi"
						onblur={(value) => handleFieldBlur('lastName', value)}
					/>
				</div>
			</FormCard>

			<!-- Dati di Nascita -->
			<FormCard title="Dati di Nascita" icon="calendar" subtitle="Data e luogo di nascita">
				<Input
					name="birthDate"
					label="Data di Nascita"
					type="date"
					value={birthDate}
					error={getFieldError('birthDate')}
					required
					onblur={(value) => {
						birthDateOverride = value;
						handleFieldBlur('birthDate', value);
					}}
				/>

				{#if isUnder16}
					<div class="under16-warning">
						<svg class="warning-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
						</svg>
						<div class="warning-content">
							<p class="warning-title">Iscrizione non disponibile per minori di 16 anni</p>
							<p class="warning-text">Il tesseramento online e riservato ai maggiori di 16 anni. Per informazioni su come iscrivere un minore, contatta direttamente l'associazione a <a href="mailto:info@dopo.space">info@dopo.space</a></p>
						</div>
					</div>
				{/if}

				<Listbox
					name="nationality"
					label="Nazionalita"
					options={nationalityOptions}
					value={nationality}
					error={getFieldError('nationality')}
					required
					disabled={isUnder16}
					placeholder="Seleziona..."
					onchange={handleNationalityChange}
					onblur={(value) => handleFieldBlur('nationality', value)}
				/>

				{#if isItalian}
					<!-- Hidden field for birthProvince (auto-filled by city autocomplete) -->
					<input type="hidden" name="birthProvince" value={birthProvince} />

					<div class="grid grid-cols-1 md:grid-cols-3 gap-4">
						<div class="md:col-span-2">
							<AddressAutocomplete
								name="birthCity"
								label="Comune di Nascita"
								mode="city"
								apiKey={data.googlePlacesApiKey}
								value={birthCity}
								error={getFieldError('birthCity')}
								required
								disabled={isUnder16}
								placeholder="Digita per cercare..."
								onselect={handleBirthCitySelect}
								onblur={(value) => handleFieldBlur('birthCity', value)}
							/>
						</div>
						<Input
							name="birthProvinceDisplay"
							label="Provincia"
							type="text"
							value={birthProvince}
							disabled
						/>
					</div>
				{:else if nationality}
					<!-- For foreigners: EE province -->
					<input type="hidden" name="birthProvince" value="EE" />

					<AddressAutocomplete
						name="birthCity"
						label="Paese di Origine"
						mode="country"
						excludeCountries={['IT']}
						apiKey={data.googlePlacesApiKey}
						value={form?.values?.birthCity || data.profile?.birthCity || ''}
						error={getFieldError('birthCity')}
						required
						disabled={isUnder16}
						placeholder="Digita per cercare..."
						onblur={(value) => handleFieldBlur('birthCity', value)}
					/>
				{/if}
			</FormCard>

			<!-- Codice Fiscale -->
			<FormCard title="Codice Fiscale" icon="id-card" subtitle="Il tuo identificativo fiscale">
				{#if showTaxCodeField}
					<Input
						name="taxCode"
						label="Codice Fiscale"
						type="text"
						value={form?.values?.taxCode || data.profile?.taxCode || ''}
						error={getFieldError('taxCode') ? 'Codice fiscale non valido' : undefined}
						required={!isForeigner}
						disabled={isUnder16}
						placeholder="RSSMRA85M10H501S"
						maxlength={16}
						onblur={(value) => handleFieldBlur('taxCode', value)}
					/>
				{/if}

				{#if isForeigner}
					<Checkbox
						name="hasForeignTaxCode"
						label="Ho un Codice Fiscale italiano"
						checked={hasForeignTaxCode}
						disabled={isUnder16}
						onchange={(checked) => hasForeignTaxCodeOverride = checked}
						onblur={(checked) => handleCheckboxBlur('hasForeignTaxCode', checked)}
					/>

					{#if !hasForeignTaxCode}
						<Listbox
							name="gender"
							label="Sesso"
							options={genderOptions}
							value={gender}
							error={getFieldError('gender')}
							required
							disabled={isUnder16}
							placeholder="Seleziona..."
							onchange={(value) => genderOverride = value}
							onblur={(value) => handleFieldBlur('gender', value)}
						/>

						<input type="hidden" name="taxCode" value="" />
					{/if}
				{/if}
			</FormCard>

			<!-- Residenza -->
			<FormCard title="Residenza" icon="home" subtitle="Indirizzo di residenza attuale">
				<!-- Hidden field for residence country -->
				<input type="hidden" name="residenceCountry" value={residenceCountry} />

				<AddressAutocomplete
					name="address"
					label="Indirizzo"
					mode="address"
					apiKey={data.googlePlacesApiKey}
					value={address}
					error={getFieldError('address')}
					required
					disabled={isUnder16}
					placeholder="Digita per cercare..."
					onselect={handleAddressSelect}
					onblur={(value) => handleFieldBlur('address', value)}
				/>

				{#if isForeignResidence}
					<!-- Hidden fields for foreign residence -->
					<input type="hidden" name="postalCode" value="00000" />
					<input type="hidden" name="province" value="EE" />
					<input type="hidden" name="city" value={city} />

					<Input
						name="residenceCountryDisplay"
						label="Paese di Residenza"
						type="text"
						value={getCountryName(residenceCountry)}
						disabled
					/>
				{:else}
					<!-- Hidden fields populated from address autocomplete -->
					<input type="hidden" name="postalCode" value={postalCode} />
					<input type="hidden" name="province" value={province} />
					<input type="hidden" name="city" value={city} />

					<div class="grid grid-cols-1 md:grid-cols-3 gap-4">
						<Input
							name="postalCodeDisplay"
							label="CAP"
							type="text"
							value={postalCode}
							disabled
						/>
						<Input
							name="cityDisplay"
							label="Comune"
							type="text"
							value={city}
							disabled
						/>
						<Input
							name="provinceDisplay"
							label="Provincia"
							type="text"
							value={province}
							disabled
						/>
					</div>
				{/if}
			</FormCard>

			<!-- Contatti -->
			<FormCard title="Contatti" icon="phone" subtitle="Come possiamo contattarti">
				<PhoneInput
					name="phone"
					label="Cellulare (opzionale)"
					value={form?.values?.phone || data.profile?.phone || ''}
					error={getFieldError('phone')}
					disabled={isUnder16}
					onblur={(value) => handleFieldBlur('phone', value)}
				/>
			</FormCard>

			<!-- Consensi -->
			<FormCard title="Privacy e Consensi" icon="shield" subtitle="Protezione dei tuoi dati">
				<ConsentSection
					privacyConsent={form?.values?.privacyConsent || data.profile?.privacyConsent || false}
					dataConsent={form?.values?.dataConsent || data.profile?.dataConsent || false}
					privacyError={getFieldError('privacyConsent')}
					dataError={getFieldError('dataConsent')}
					disabled={isUnder16}
					onPrivacyBlur={(checked) => handleCheckboxBlur('privacyConsent', checked)}
					onDataBlur={(checked) => handleCheckboxBlur('dataConsent', checked)}
				/>
			</FormCard>

			<div class="submit-section">
				<Button type="submit" variant="primary" {loading} disabled={isUnder16} fullWidth>
					{#if loading}
						Salvataggio...
					{:else if data.membershipState === SystemState.S4_AWAITING_NUMBER || data.membershipState === SystemState.S5_ACTIVE}
						Salva modifiche
					{:else if data.profileComplete}
						Salva modifiche
					{:else}
						Salva e continua
					{/if}
				</Button>
			</div>
		</form>
		{/if}

		<!-- Payment CTA - Show only if profile is complete and payment is possible -->
		{#if data.canProceedToPayment}
			<div class="payment-section">
				<a href="/membership/checkout" class="payment-link">
					<Button variant="secondary" fullWidth>
						{#if data.membershipState === SystemState.S6_EXPIRED}
							Rinnova la tessera
						{:else if data.membershipState === SystemState.S3_PAYMENT_FAILED}
							Riprova il pagamento
						{:else}
							Procedi al pagamento
						{/if}
					</Button>
				</a>
			</div>
		{/if}

		<div class="back-link">
			<a href="/">Torna alla home</a>
		</div>
	</div>
</div>

{#if showSuccessToast}
	<Toast
		message="Profilo salvato con successo!"
		type="success"
		onclose={() => showSuccessToast = false}
	/>
{/if}

{#if showErrorToast}
	<Toast
		message="Si è verificato un errore. Controlla i campi evidenziati."
		type="error"
		duration={5000}
		onclose={() => showErrorToast = false}
	/>
{/if}

<style>
	@reference "tailwindcss";

	.subscription-page {
		@apply min-h-screen;
		background-color: var(--color-dopoRed);
	}

	.form-container {
		@apply w-full max-w-6xl mx-auto px-4 py-12 md:px-8 md:py-16 lg:px-12;
	}

	.field-hint {
		@apply text-sm text-gray-500 -mt-4 mb-6;
	}

	.info-box {
		@apply flex gap-3 p-4 bg-blue-50 border border-blue-100 rounded-lg text-blue-700 text-sm;
	}

	.info-icon {
		@apply w-5 h-5 flex-shrink-0 mt-0.5;
	}

	.info-box p {
		@apply m-0;
	}

	.submit-section {
		@apply mt-8;
	}

	.back-link {
		@apply mt-8 text-center;
	}

	.back-link a {
		@apply text-white/80 hover:text-white underline hover:no-underline transition-colors;
	}

	.under16-warning {
		@apply flex gap-4 p-4 bg-amber-50 border border-amber-200 rounded-lg mb-6;
	}

	.warning-icon {
		@apply w-6 h-6 text-amber-600 flex-shrink-0 mt-0.5;
	}

	.warning-content {
		@apply flex-1;
	}

	.warning-title {
		@apply font-semibold text-amber-800 mb-1;
	}

	.warning-text {
		@apply text-amber-700 text-sm leading-relaxed;
	}

	.warning-text a {
		@apply text-amber-800 underline hover:no-underline;
	}

	/* Membership Status Cards */
	.status-card {
		@apply flex gap-4 p-4 rounded-lg;
	}

	.status-card.success {
		@apply bg-green-50;
	}

	.status-card.warning {
		@apply bg-amber-50;
	}

	.status-icon-wrapper {
		@apply flex-shrink-0;
	}

	.status-icon {
		@apply w-8 h-8;
	}

	.status-card.success .status-icon {
		@apply text-green-500;
	}

	.status-card.warning .status-icon {
		@apply text-amber-500;
	}

	.status-content {
		@apply flex-1;
	}

	.status-title {
		@apply font-semibold text-gray-900 mb-1;
	}

	.status-number {
		@apply text-green-700 mb-2;
	}

	.status-text {
		@apply text-gray-600 text-sm;
	}

	.status-cta {
		@apply inline-block mt-3 text-amber-700 font-medium hover:text-amber-800 underline hover:no-underline;
	}

	/* Payment Section */
	.payment-section {
		@apply mt-4;
	}

	.payment-link {
		@apply block;
	}

	/* Profile Toggle (collapsible section) */
	.profile-toggle {
		@apply w-full flex items-center justify-between p-4 bg-white rounded-xl shadow-sm border border-gray-100 mb-6 cursor-pointer transition-all;
	}

	.profile-toggle:hover {
		@apply shadow-md border-gray-200;
	}

	.profile-toggle-content {
		@apply flex items-center gap-4;
	}

	.profile-toggle-icon {
		@apply w-10 h-10 p-2 rounded-lg bg-blue-100 text-blue-600;
	}

	.profile-toggle-text {
		@apply flex flex-col items-start;
	}

	.profile-toggle-title {
		@apply font-semibold text-gray-900;
	}

	.profile-toggle-subtitle {
		@apply text-sm text-gray-500;
	}

	.profile-toggle-chevron {
		@apply w-5 h-5 text-gray-400 transition-transform duration-200;
	}

	.profile-toggle-chevron.expanded {
		@apply rotate-180;
	}
</style>
