<script lang="ts">
	import { enhance } from '$app/forms';
	import Input from '$lib/components/forms/Input.svelte';
	import Button from '$lib/components/forms/Button.svelte';
	import ErrorMessage from '$lib/components/forms/ErrorMessage.svelte';
	import AddressAutocomplete, { type AddressResult } from '$lib/components/forms/AddressAutocomplete.svelte';
	import type { PageData } from './$types';

	type FormValues = {
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

	// Combined form data type for all actions
	type FormData = {
		// Update action fields
		errors?: Record<string, string>;
		values?: FormValues;
		success?: boolean;
		// Cancel action fields
		cancelError?: string;
		cancelSuccess?: boolean;
		previousNumber?: string | null;
		// Status update action fields
		statusError?: string;
		statusSuccess?: boolean;
	} | null;

	let { data, form }: { data: PageData; form: FormData } = $props();
	let loading = $state(false);
	let showCancelDialog = $state(false);
	let cancelLoading = $state(false);
	let statusLoading = $state(false);

	// Status form state
	let selectedStatus = $state(data.user.membership?.status ?? 'PENDING');
	let selectedPaymentStatus = $state(data.user.membership?.paymentStatus ?? 'PENDING');

	// Form state
	let nationality = $state(form?.values?.nationality ?? data.user.profile?.nationality ?? 'IT');
	let hasForeignTaxCode = $state(form?.values?.hasForeignTaxCode ?? data.user.profile?.hasForeignTaxCode ?? false);
	let gender = $state(form?.values?.gender ?? data.user.profile?.gender ?? '');

	// Address fields (can be populated by autocomplete or manual entry)
	let addressOverride = $state<string | null>(null);
	let cityOverride = $state<string | null>(null);
	let postalCodeOverride = $state<string | null>(null);
	let provinceOverride = $state<string | null>(null);
	let residenceCountryOverride = $state<string | null>(null);

	// Birth city/province overrides
	let birthCityOverride = $state<string | null>(null);
	let birthProvinceOverride = $state<string | null>(null);

	// Derived values for address fields
	let addressValue = $derived(addressOverride ?? form?.values?.address ?? data.user.profile?.address ?? '');
	let cityValue = $derived(cityOverride ?? form?.values?.city ?? data.user.profile?.city ?? '');
	let postalCodeValue = $derived(postalCodeOverride ?? form?.values?.postalCode ?? data.user.profile?.postalCode ?? '');
	let residenceCountryValue = $derived(residenceCountryOverride ?? data.user.profile?.residenceCountry ?? 'IT');

	// Province: auto-set to "EE" for foreign residence
	let isForeignResidence = $derived(residenceCountryValue !== 'IT');
	let provinceValue = $derived(
		isForeignResidence
			? 'EE'
			: (provinceOverride ?? form?.values?.province ?? data.user.profile?.province ?? '')
	);

	// Derived values for birth city/province
	let birthCityValue = $derived(birthCityOverride ?? form?.values?.birthCity ?? data.user.profile?.birthCity ?? '');
	let birthProvinceValue = $derived(birthProvinceOverride ?? form?.values?.birthProvince ?? data.user.profile?.birthProvince ?? '');

	// Handle address selection from autocomplete
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

	// Handle nationality change - clear birth city when nationality changes
	function handleNationalityChange(value: string) {
		nationality = value;
		// Clear birth city and province when nationality changes
		birthCityOverride = '';
		birthProvinceOverride = '';
	}

	// Handle birth city selection from autocomplete
	function handleBirthCitySelect(result: AddressResult) {
		if (result.city) birthCityOverride = result.city;
		if (result.province) birthProvinceOverride = result.province;
	}

	// Derived values for foreign users
	let isForeign = $derived(nationality !== 'IT' && nationality !== '');

	function formatDate(isoString: string): string {
		return new Date(isoString).toLocaleDateString('it-IT', {
			year: 'numeric',
			month: 'long',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	function formatDateForInput(isoString: string | null): string {
		if (!isoString) return '';
		return isoString.split('T')[0];
	}

	function getFieldValue<K extends keyof FormValues>(field: K, profileField: keyof NonNullable<typeof data.user.profile>): string {
		if (form?.values?.[field] !== undefined) {
			return String(form.values[field] ?? '');
		}
		const profileValue = data.user.profile?.[profileField];
		if (profileValue === null || profileValue === undefined) return '';
		return String(profileValue);
	}
</script>

<div class="space-y-6 max-w-4xl">
	<!-- Breadcrumb -->
	<nav class="flex items-center gap-2 text-sm">
		<a href="/admin/users" class="text-gray-500 hover:text-gray-700">Utenti</a>
		<span class="text-gray-400">/</span>
		<span class="text-gray-900 font-medium">
			{data.user.profile?.firstName || ''} {data.user.profile?.lastName || data.user.email}
		</span>
	</nav>

	<!-- Page Header -->
	<div>
		<h1 class="text-2xl font-bold text-gray-900">Dettaglio Utente</h1>
		<p class="text-sm text-gray-600 mt-1">{data.user.email}</p>
	</div>

	<!-- User Information Card -->
	<div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
		<h2 class="text-xl font-bold text-gray-900 mb-4">Informazioni Account</h2>

		<dl class="grid grid-cols-1 md:grid-cols-2 gap-4">
			<div>
				<dt class="text-sm font-medium text-gray-500">Email</dt>
				<dd class="mt-1 text-sm text-gray-900">{data.user.email}</dd>
			</div>

			<div>
				<dt class="text-sm font-medium text-gray-500">Newsletter</dt>
				<dd class="mt-1 text-sm text-gray-900">
					{data.user.newsletterSubscribed ? 'Iscritto' : 'Non iscritto'}
				</dd>
			</div>

			<div>
				<dt class="text-sm font-medium text-gray-500">Profilo Completato</dt>
				<dd class="mt-1 text-sm text-gray-900">
					{data.user.profile?.profileComplete ? 'Sì' : 'No'}
				</dd>
			</div>

			<div>
				<dt class="text-sm font-medium text-gray-500">Data Registrazione</dt>
				<dd class="mt-1 text-sm text-gray-900">{formatDate(data.user.createdAt)}</dd>
			</div>
		</dl>
	</div>

	<!-- Membership Card -->
	<div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
		<h2 class="text-xl font-bold text-gray-900 mb-4">Tessera Associativa</h2>

		{#if form?.cancelError}
			<div class="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
				<p class="text-sm text-red-700">{form.cancelError}</p>
			</div>
		{/if}

		{#if form?.cancelSuccess}
			<div class="mb-4 p-3 bg-green-50 border border-green-200 rounded-md">
				<p class="text-sm text-green-700">
					Tessera cancellata con successo.
					{#if form.previousNumber}
						Numero precedente: {form.previousNumber}
					{/if}
				</p>
			</div>
		{/if}

		{#if data.user.membership}
			<dl class="grid grid-cols-1 md:grid-cols-2 gap-4">
				<div>
					<dt class="text-sm font-medium text-gray-500">Numero Tessera</dt>
					<dd class="mt-1">
						{#if data.user.membership.membershipNumber}
							<span class="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-green-100 text-green-800">
								{data.user.membership.membershipNumber}
							</span>
						{:else}
							<span class="text-sm text-yellow-600">In attesa di assegnazione</span>
						{/if}
					</dd>
				</div>

				{#if data.user.membership.previousMembershipNumber}
					<div>
						<dt class="text-sm font-medium text-gray-500">Numero Tessera Precedente</dt>
						<dd class="mt-1">
							<span class="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-gray-100 text-gray-600">
								{data.user.membership.previousMembershipNumber}
							</span>
						</dd>
					</div>
				{/if}

				<div>
					<dt class="text-sm font-medium text-gray-500">Stato Iscrizione</dt>
					<dd class="mt-1">
						{#if data.user.membership.status === 'ACTIVE'}
							<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
								Attiva
							</span>
						{:else if data.user.membership.status === 'PENDING'}
							<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
								In attesa
							</span>
						{:else if data.user.membership.status === 'EXPIRED'}
							<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
								Scaduta
							</span>
						{:else if data.user.membership.status === 'CANCELED'}
							<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
								Cancellata
							</span>
						{:else}
							<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
								{data.user.membership.status}
							</span>
						{/if}
					</dd>
				</div>

				<div>
					<dt class="text-sm font-medium text-gray-500">Stato Pagamento</dt>
					<dd class="mt-1">
						{#if data.user.membership.paymentStatus === 'SUCCEEDED'}
							<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
								Pagato
							</span>
						{:else if data.user.membership.paymentStatus === 'PENDING'}
							<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
								In attesa
							</span>
						{:else if data.user.membership.paymentStatus === 'FAILED'}
							<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
								Fallito
							</span>
						{:else}
							<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
								{data.user.membership.paymentStatus}
							</span>
						{/if}
					</dd>
				</div>

				{#if data.user.membership.startDate || data.user.membership.endDate}
					<div>
						<dt class="text-sm font-medium text-gray-500">Validità</dt>
						<dd class="mt-1 text-sm text-gray-900">
							{#if data.user.membership.startDate}
								{new Date(data.user.membership.startDate).toLocaleDateString('it-IT')}
							{/if}
							{#if data.user.membership.startDate && data.user.membership.endDate} - {/if}
							{#if data.user.membership.endDate}
								{new Date(data.user.membership.endDate).toLocaleDateString('it-IT')}
							{/if}
						</dd>
					</div>
				{/if}

				{#if data.user.membership.cardAssignedAt}
					<div>
						<dt class="text-sm font-medium text-gray-500">Data Assegnazione Tessera</dt>
						<dd class="mt-1 text-sm text-gray-900">
							{formatDate(data.user.membership.cardAssignedAt)}
						</dd>
					</div>
				{/if}

				{#if data.user.membership.paymentAmount}
					<div>
						<dt class="text-sm font-medium text-gray-500">Importo Pagato</dt>
						<dd class="mt-1 text-sm text-gray-900">
							€{(data.user.membership.paymentAmount / 100).toFixed(2)}
						</dd>
					</div>
				{/if}

				{#if data.user.membership.paymentProviderId}
					<div>
						<dt class="text-sm font-medium text-gray-500">ID Transazione PayPal</dt>
						<dd class="mt-1 text-sm text-gray-900 font-mono text-xs break-all">
							{data.user.membership.paymentProviderId}
						</dd>
					</div>
				{/if}

				<div>
					<dt class="text-sm font-medium text-gray-500">Creata il</dt>
					<dd class="mt-1 text-sm text-gray-900">
						{formatDate(data.user.membership.createdAt)}
					</dd>
				</div>

				<div>
					<dt class="text-sm font-medium text-gray-500">Ultima Modifica</dt>
					<dd class="mt-1 text-sm text-gray-900">
						{formatDate(data.user.membership.updatedAt)}
					</dd>
				</div>

				{#if data.user.membership.updatedBy}
					<div>
						<dt class="text-sm font-medium text-gray-500">Modificata da</dt>
						<dd class="mt-1 text-sm text-gray-900 font-mono text-xs">
							{data.user.membership.updatedBy}
						</dd>
					</div>
				{/if}
			</dl>

			<!-- Status Update Form -->
			<div class="mt-6 pt-4 border-t border-gray-200">
				<h3 class="text-sm font-medium text-gray-700 mb-3">Modifica Stato</h3>

				{#if form?.statusError}
					<div class="mb-3 p-2 bg-red-50 border border-red-200 rounded-md">
						<p class="text-sm text-red-700">{form.statusError}</p>
					</div>
				{/if}

				{#if form?.statusSuccess}
					<div class="mb-3 p-2 bg-green-50 border border-green-200 rounded-md">
						<p class="text-sm text-green-700">Stato aggiornato con successo</p>
					</div>
				{/if}

				<form
					method="POST"
					action="?/updateStatus"
					use:enhance={() => {
						statusLoading = true;
						return async ({ update }) => {
							await update({ invalidateAll: true, reset: false });
							statusLoading = false;
						};
					}}
					class="flex flex-wrap items-end gap-4"
				>
					<input type="hidden" name="membershipId" value={data.user.membership.id} />

					<div class="flex-1 min-w-[150px]">
						<label for="status" class="block text-xs font-medium text-gray-500 mb-1">
							Stato Iscrizione
						</label>
						<select
							id="status"
							name="status"
							bind:value={selectedStatus}
							class="w-full px-3 py-2 text-sm border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
						>
							<option value="PENDING">In attesa</option>
							<option value="ACTIVE">Attiva</option>
							<option value="EXPIRED">Scaduta</option>
							<option value="CANCELED">Cancellata</option>
						</select>
					</div>

					<div class="flex-1 min-w-[150px]">
						<label for="paymentStatus" class="block text-xs font-medium text-gray-500 mb-1">
							Stato Pagamento
						</label>
						<select
							id="paymentStatus"
							name="paymentStatus"
							bind:value={selectedPaymentStatus}
							class="w-full px-3 py-2 text-sm border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
						>
							<option value="PENDING">In attesa</option>
							<option value="SUCCEEDED">Pagato</option>
							<option value="FAILED">Fallito</option>
						</select>
					</div>

					<button
						type="submit"
						disabled={statusLoading}
						class="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
					>
						{statusLoading ? 'Salvataggio...' : 'Aggiorna Stato'}
					</button>
				</form>
			</div>

			<!-- Cancel Membership Action -->
			{#if data.user.membership.status !== 'CANCELED' && data.user.membership.status !== 'EXPIRED'}
				<div class="mt-6 pt-4 border-t border-gray-200">
					<button
						type="button"
						onclick={() => showCancelDialog = true}
						class="inline-flex items-center px-4 py-2 text-sm font-medium text-red-700 bg-red-50 border border-red-200 rounded-md hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-500"
					>
						<svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
						</svg>
						Annulla Tessera
					</button>
				</div>
			{/if}
		{:else}
			<div class="text-center py-6 text-gray-500">
				<p>Nessuna tessera associativa</p>
				<p class="text-sm mt-1">L'utente non ha ancora iniziato il processo di iscrizione.</p>
			</div>
		{/if}
	</div>

	<!-- Cancel Confirmation Dialog -->
	{#if showCancelDialog && data.user.membership}
		<div class="fixed inset-0 z-50 overflow-y-auto">
			<div class="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
				<div class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onclick={() => showCancelDialog = false}></div>

				<div class="relative transform overflow-hidden rounded-lg bg-white text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg">
					<div class="bg-white px-4 pb-4 pt-5 sm:p-6 sm:pb-4">
						<div class="sm:flex sm:items-start">
							<div class="mx-auto flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-red-100 sm:mx-0 sm:h-10 sm:w-10">
								<svg class="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
									<path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
								</svg>
							</div>
							<div class="mt-3 text-center sm:ml-4 sm:mt-0 sm:text-left">
								<h3 class="text-base font-semibold leading-6 text-gray-900">Annulla Tessera</h3>
								<div class="mt-2">
									<p class="text-sm text-gray-500">
										Sei sicuro di voler annullare la tessera di questo utente?
										{#if data.user.membership.membershipNumber}
											Il numero tessera <strong>{data.user.membership.membershipNumber}</strong> verrà salvato come numero precedente e potrà essere riassegnato.
										{/if}
									</p>
								</div>
							</div>
						</div>
					</div>
					<div class="bg-gray-50 px-4 py-3 sm:flex sm:flex-row-reverse sm:px-6">
						<form
							method="POST"
							action="?/cancel"
							use:enhance={() => {
								cancelLoading = true;
								return async ({ update }) => {
									await update({ invalidateAll: true });
									cancelLoading = false;
									showCancelDialog = false;
								};
							}}
						>
							<input type="hidden" name="membershipId" value={data.user.membership.id} />
							<button
								type="submit"
								disabled={cancelLoading}
								class="inline-flex w-full justify-center rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-500 sm:ml-3 sm:w-auto disabled:opacity-50"
							>
								{cancelLoading ? 'Annullamento...' : 'Conferma Annullamento'}
							</button>
						</form>
						<button
							type="button"
							onclick={() => showCancelDialog = false}
							class="mt-3 inline-flex w-full justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:mt-0 sm:w-auto"
						>
							Annulla
						</button>
					</div>
				</div>
			</div>
		</div>
	{/if}

	<!-- Edit Profile Form -->
	<div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
		<h2 class="text-xl font-bold text-gray-900 mb-4">Modifica Dati Profilo</h2>

		{#if form?.errors?._form}
			<ErrorMessage>{form.errors._form}</ErrorMessage>
		{/if}

		<form
			method="POST"
			action="?/update"
			use:enhance={() => {
				loading = true;
				return async ({ update }) => {
					await update({ invalidateAll: true, reset: false });
					loading = false;
				};
			}}
		>
			<!-- Dati Anagrafici -->
			<div class="mb-6">
				<h3 class="text-lg font-medium text-gray-900 mb-4">Dati Anagrafici</h3>
				<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
					<Input
						name="firstName"
						label="Nome"
						type="text"
						value={getFieldValue('firstName', 'firstName')}
						error={form?.errors?.firstName}
						required
					/>

					<Input
						name="lastName"
						label="Cognome"
						type="text"
						value={getFieldValue('lastName', 'lastName')}
						error={form?.errors?.lastName}
						required
					/>

					<Input
						name="birthDate"
						label="Data di Nascita"
						type="date"
						value={form?.values?.birthDate ?? formatDateForInput(data.user.profile?.birthDate ?? null)}
						error={form?.errors?.birthDate}
					/>

					<div>
						<label for="nationality" class="block text-sm font-medium text-gray-700 mb-1">
							Nazionalità
						</label>
						<select
							id="nationality"
							name="nationality"
							value={nationality}
							onchange={(e) => handleNationalityChange((e.target as HTMLSelectElement).value)}
							class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
						>
							<option value="IT">Italiana</option>
							<option value="DE">Germania</option>
							<option value="FR">Francia</option>
							<option value="ES">Spagna</option>
							<option value="UK">Regno Unito</option>
							<option value="US">Stati Uniti</option>
							<option value="CH">Svizzera</option>
							<option value="AT">Austria</option>
							<option value="BE">Belgio</option>
							<option value="NL">Paesi Bassi</option>
							<option value="PT">Portogallo</option>
							<option value="PL">Polonia</option>
							<option value="RO">Romania</option>
							<option value="XX">Altro</option>
						</select>
						{#if form?.errors?.nationality}
							<p class="mt-1 text-sm text-red-600">{form.errors.nationality}</p>
						{/if}
					</div>
				</div>
			</div>

			<!-- Dati di Nascita -->
			<div class="mb-6">
				<h3 class="text-lg font-medium text-gray-900 mb-4">Luogo di Nascita</h3>
				{#if !isForeign}
					<!-- For Italians: city search with province auto-fill -->
					<div class="grid grid-cols-1 md:grid-cols-3 gap-4">
						<div class="md:col-span-2">
							<AddressAutocomplete
								name="birthCity"
								label="Comune di Nascita"
								mode="city"
								apiKey={data.googlePlacesApiKey}
								value={birthCityValue}
								error={form?.errors?.birthCity}
								placeholder="Digita per cercare..."
								onselect={handleBirthCitySelect}
							/>
						</div>
						<Input
							name="birthProvince"
							label="Provincia"
							type="text"
							value={birthProvinceValue}
							error={form?.errors?.birthProvince}
							maxlength={2}
							placeholder="Es: MI"
						/>
					</div>
				{:else}
					<!-- For foreigners: country search, EE province -->
					<input type="hidden" name="birthProvince" value="EE" />
					<AddressAutocomplete
						name="birthCity"
						label="Paese di Origine"
						mode="country"
						excludeCountries={['IT']}
						apiKey={data.googlePlacesApiKey}
						value={birthCityValue}
						error={form?.errors?.birthCity}
						placeholder="Digita per cercare..."
					/>
				{/if}
			</div>

			<!-- Codice Fiscale e Sesso -->
			<div class="mb-6">
				<h3 class="text-lg font-medium text-gray-900 mb-4">Codice Fiscale e Sesso</h3>

				{#if isForeign}
					<div class="mb-4">
						<label class="flex items-center gap-2">
							<input
								type="checkbox"
								name="hasForeignTaxCode"
								value="true"
								bind:checked={hasForeignTaxCode}
								class="h-4 w-4 text-orange-600 border-gray-300 rounded focus:ring-orange-500"
							/>
							<span class="text-sm text-gray-700">L'utente ha un codice fiscale italiano</span>
						</label>
					</div>
				{:else}
					<input type="hidden" name="hasForeignTaxCode" value="false" />
				{/if}

				<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
					<Input
						name="taxCode"
						label="Codice Fiscale"
						type="text"
						value={getFieldValue('taxCode', 'taxCode')}
						error={form?.errors?.taxCode}
						maxlength={16}
						placeholder="Es: RSSMRA85M10H501S"
					/>

					<div>
						<label for="gender" class="block text-sm font-medium text-gray-700 mb-1">
							Sesso
						</label>
						<select
							id="gender"
							name="gender"
							bind:value={gender}
							class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
						>
							<option value="">Seleziona...</option>
							<option value="M">Maschio</option>
							<option value="F">Femmina</option>
						</select>
						{#if form?.errors?.gender}
							<p class="mt-1 text-sm text-red-600">{form.errors.gender}</p>
						{/if}
						<p class="mt-1 text-xs text-gray-500">
							Se presente il CF, il sesso viene derivato automaticamente
						</p>
					</div>
				</div>

				{#if isForeign && !hasForeignTaxCode}
					<p class="text-sm text-gray-500 mt-3">
						Per gli utenti stranieri senza CF italiano, il campo CF verrà lasciato vuoto (export AICS: 16 zeri).
					</p>
				{/if}
			</div>

			<!-- Residenza -->
			<div class="mb-6">
				<h3 class="text-lg font-medium text-gray-900 mb-4">Residenza</h3>

				<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
					<div class="md:col-span-2">
						<AddressAutocomplete
							name="address"
							label="Indirizzo"
							mode="address"
							apiKey={data.googlePlacesApiKey}
							value={addressValue}
							error={form?.errors?.address}
							placeholder="Digita per cercare..."
							onselect={handleAddressSelect}
						/>
					</div>

					<div>
						<label for="residenceCountry" class="block text-sm font-medium text-gray-700 mb-1">
							Paese di Residenza
						</label>
						<select
							id="residenceCountry"
							name="residenceCountry"
							value={residenceCountryValue}
							onchange={(e) => residenceCountryOverride = (e.target as HTMLSelectElement).value}
							class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
						>
							<option value="IT">Italia</option>
							<option value="DE">Germania</option>
							<option value="FR">Francia</option>
							<option value="ES">Spagna</option>
							<option value="UK">Regno Unito</option>
							<option value="US">Stati Uniti</option>
							<option value="CH">Svizzera</option>
							<option value="AT">Austria</option>
							<option value="BE">Belgio</option>
							<option value="NL">Paesi Bassi</option>
							<option value="PT">Portogallo</option>
							<option value="PL">Polonia</option>
							<option value="RO">Romania</option>
							<option value="XX">Altro</option>
						</select>
						{#if form?.errors?.residenceCountry}
							<p class="mt-1 text-sm text-red-600">{form.errors.residenceCountry}</p>
						{/if}
					</div>

					<Input
						name="city"
						label={isForeignResidence ? "Citta" : "Comune"}
						type="text"
						value={cityValue}
						error={form?.errors?.city}
						placeholder={isForeignResidence ? "Es: Londra" : "Es: Milano"}
					/>

					{#if isForeignResidence}
						<!-- Hidden fields for foreign residence -->
						<input type="hidden" name="postalCode" value="00000" />
						<input type="hidden" name="province" value="EE" />
					{:else}
						<div class="grid grid-cols-2 gap-4">
							<Input
								name="postalCode"
								label="CAP"
								type="text"
								value={postalCodeValue}
								error={form?.errors?.postalCode}
								maxlength={5}
								placeholder="Es: 20100"
							/>

							<Input
								name="province"
								label="Provincia"
								type="text"
								value={provinceValue}
								error={form?.errors?.province}
								maxlength={2}
								placeholder="Es: MI"
							/>
						</div>
					{/if}
				</div>
			</div>

			<!-- Contatti -->
			<div class="mb-6">
				<h3 class="text-lg font-medium text-gray-900 mb-4">Contatti</h3>
				<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
					<Input
						name="phone"
						label="Cellulare"
						type="tel"
						value={getFieldValue('phone', 'phone')}
						error={form?.errors?.phone}
						placeholder="Es: +393331234567"
					/>

					<div>
						<label for="email-readonly" class="block text-sm font-medium text-gray-700 mb-1">
							Email
						</label>
						<input
							id="email-readonly"
							type="email"
							value={data.user.email}
							disabled
							class="w-full px-3 py-2 border border-gray-200 rounded-md bg-gray-50 text-gray-500"
						/>
						<p class="mt-1 text-xs text-gray-500">L'email non può essere modificata</p>
					</div>
				</div>
			</div>

			<!-- Consensi -->
			<div class="mb-6">
				<h3 class="text-lg font-medium text-gray-900 mb-4">Consensi</h3>
				<div class="space-y-3">
					<label class="flex items-start gap-3">
						<input
							type="checkbox"
							name="privacyConsent"
							value="true"
							checked={form?.values?.privacyConsent ?? data.user.profile?.privacyConsent ?? false}
							class="mt-1 h-4 w-4 text-orange-600 border-gray-300 rounded focus:ring-orange-500"
						/>
						<span class="text-sm text-gray-700">
							Accetta la Privacy Policy
						</span>
					</label>

					<label class="flex items-start gap-3">
						<input
							type="checkbox"
							name="dataConsent"
							value="true"
							checked={form?.values?.dataConsent ?? data.user.profile?.dataConsent ?? false}
							class="mt-1 h-4 w-4 text-orange-600 border-gray-300 rounded focus:ring-orange-500"
						/>
						<span class="text-sm text-gray-700">
							Acconsente al trattamento dei dati
						</span>
					</label>
				</div>
			</div>

			<!-- Actions -->
			<div class="flex gap-4 pt-4 border-t border-gray-200">
				<Button type="submit" variant="primary" {loading}>
					{loading ? 'Salvataggio...' : 'Salva Modifiche'}
				</Button>
				<a href="/admin/users" class="btn-secondary">Annulla</a>
			</div>
		</form>
	</div>
</div>
