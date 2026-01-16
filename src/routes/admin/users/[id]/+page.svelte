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
		taxCode?: string;
		address?: string;
		city?: string;
		postalCode?: string;
		province?: string;
		phone?: string;
		privacyConsent?: boolean;
		dataConsent?: boolean;
	};

	type UpdateFormData = {
		errors?: Record<string, string>;
		values?: FormValues;
	} | null;

	let { data, form }: { data: PageData; form: UpdateFormData } = $props();
	let loading = $state(false);

	// Form state
	let nationality = $state(form?.values?.nationality ?? data.user.profile?.nationality ?? 'IT');
	let hasForeignTaxCode = $state(form?.values?.hasForeignTaxCode ?? data.user.profile?.hasForeignTaxCode ?? false);

	// Address fields (can be populated by autocomplete or manual entry)
	let addressOverride = $state<string | null>(null);
	let cityOverride = $state<string | null>(null);
	let postalCodeOverride = $state<string | null>(null);
	let provinceOverride = $state<string | null>(null);

	// Derived values for address fields
	let addressValue = $derived(addressOverride ?? form?.values?.address ?? data.user.profile?.address ?? '');
	let cityValue = $derived(cityOverride ?? form?.values?.city ?? data.user.profile?.city ?? '');
	let postalCodeValue = $derived(postalCodeOverride ?? form?.values?.postalCode ?? data.user.profile?.postalCode ?? '');
	let provinceValue = $derived(provinceOverride ?? form?.values?.province ?? data.user.profile?.province ?? '');

	// Handle address selection from autocomplete
	function handleAddressSelect(result: AddressResult) {
		addressOverride = result.address;
		cityOverride = result.city;
		postalCodeOverride = result.postalCode;
		provinceOverride = result.province;
	}

	// Derived values for foreign users
	let isForeign = $derived(nationality !== 'IT' && nationality !== '');
	let showTaxCodeField = $derived(!isForeign || hasForeignTaxCode);

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
		<a href="/users" class="text-gray-500 hover:text-gray-700">Utenti</a>
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

				<div>
					<dt class="text-sm font-medium text-gray-500">Stato Membership</dt>
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
			</dl>
		{:else}
			<div class="text-center py-6 text-gray-500">
				<p>Nessuna tessera associativa</p>
				<p class="text-sm mt-1">L'utente non ha ancora iniziato il processo di iscrizione.</p>
			</div>
		{/if}
	</div>

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
							bind:value={nationality}
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
				<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
					<Input
						name="birthProvince"
						label="Provincia di Nascita"
						type="text"
						value={isForeign ? 'EE' : getFieldValue('birthProvince', 'birthProvince')}
						error={form?.errors?.birthProvince}
						maxlength={2}
						placeholder={isForeign ? 'EE' : 'Es: MI'}
						disabled={isForeign}
					/>

					<Input
						name="birthCity"
						label="Comune di Nascita"
						type="text"
						value={isForeign && !getFieldValue('birthCity', 'birthCity') ? '' : getFieldValue('birthCity', 'birthCity')}
						error={form?.errors?.birthCity}
						placeholder={isForeign ? 'Es: Berlin, Paris' : 'Es: Milano'}
					/>
				</div>
			</div>

			<!-- Codice Fiscale -->
			<div class="mb-6">
				<h3 class="text-lg font-medium text-gray-900 mb-4">Codice Fiscale</h3>

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

				{#if showTaxCodeField}
					<Input
						name="taxCode"
						label="Codice Fiscale"
						type="text"
						value={getFieldValue('taxCode', 'taxCode')}
						error={form?.errors?.taxCode}
						maxlength={16}
						placeholder="Es: RSSMRA85M10H501S"
					/>
				{:else}
					<input type="hidden" name="taxCode" value="" />
					<p class="text-sm text-gray-500">
						Per gli utenti stranieri senza CF italiano, il campo verrà lasciato vuoto (export AICS: 16 zeri).
					</p>
				{/if}
			</div>

			<!-- Residenza -->
			<div class="mb-6">
				<h3 class="text-lg font-medium text-gray-900 mb-4">Residenza</h3>

				<AddressAutocomplete
					label="Cerca indirizzo"
					placeholder="Inizia a digitare un indirizzo..."
					onselect={handleAddressSelect}
				/>

				<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
					<div class="md:col-span-2">
						<Input
							name="address"
							label="Indirizzo"
							type="text"
							value={addressValue}
							error={form?.errors?.address}
							placeholder="Es: Via Roma 1"
						/>
					</div>

					<Input
						name="city"
						label="Comune"
						type="text"
						value={cityValue}
						error={form?.errors?.city}
						placeholder="Es: Milano"
					/>

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
				<a href="/users" class="btn-secondary">Annulla</a>
			</div>
		</form>
	</div>
</div>
