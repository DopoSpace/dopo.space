<script lang="ts">
	import { enhance } from '$app/forms';
	import Input from '$lib/components/forms/Input.svelte';
	import Button from '$lib/components/forms/Button.svelte';
	import ErrorMessage from '$lib/components/forms/ErrorMessage.svelte';
	import type { PageData } from './$types';

	// Explicit type for form action data
	type UpdateFormData = {
		errors?: {
			_form?: string;
			firstName?: string;
			lastName?: string;
		};
		values?: {
			firstName?: string;
			lastName?: string;
		};
	} | null;

	let { data, form }: { data: PageData; form: UpdateFormData } = $props();
	let loading = $state(false);

	function formatDate(isoString: string): string {
		return new Date(isoString).toLocaleDateString('it-IT', {
			year: 'numeric',
			month: 'long',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
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

	<!-- Main Content -->
		<!-- User Information Card -->
		<div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
			<h2 class="text-xl font-bold text-gray-900 mb-4">Informazioni Account</h2>

			<dl class="grid grid-cols-1 md:grid-cols-2 gap-4">
				<div>
					<dt class="text-sm font-medium text-gray-500">Email</dt>
					<dd class="mt-1 text-sm text-gray-900">{data.user.email}</dd>
				</div>

				<div>
					<dt class="text-sm font-medium text-gray-500">Telefono</dt>
					<dd class="mt-1 text-sm text-gray-900">{data.user.phone || '-'}</dd>
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

				<div>
					<dt class="text-sm font-medium text-gray-500">Ultimo Aggiornamento</dt>
					<dd class="mt-1 text-sm text-gray-900">{formatDate(data.user.updatedAt)}</dd>
				</div>
			</dl>
		</div>

		<!-- Membership Card -->
		<div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
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
									In attesa di pagamento
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
								{#if data.user.membership.startDate && data.user.membership.endDate}
									-
								{/if}
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
			<h2 class="text-xl font-bold text-gray-900 mb-4">Modifica Dati Personali</h2>

			{#if form?.errors?._form}
				<ErrorMessage>{form.errors._form}</ErrorMessage>
			{/if}

			{#if data.user.profile}
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
					<div class="grid grid-cols-1 md:grid-cols-2 gap-6">
						<Input
							name="firstName"
							label="Nome"
							type="text"
							value={form?.values?.firstName || data.user.profile.firstName}
							error={form?.errors?.firstName}
							required
						/>

						<Input
							name="lastName"
							label="Cognome"
							type="text"
							value={form?.values?.lastName || data.user.profile.lastName}
							error={form?.errors?.lastName}
							required
						/>
					</div>

					<div class="mt-6 flex gap-4">
						<Button type="submit" variant="primary" {loading}>
							{loading ? 'Salvataggio...' : 'Salva Modifiche'}
						</Button>
						<a href="/admin/users" class="btn-secondary"> Annulla </a>
					</div>
				</form>

				<!-- Additional Profile Info (Read-only) -->
				{#if data.user.profile.address !== 'Da completare'}
					<div class="mt-8 pt-6 border-t border-gray-200">
						<h3 class="text-lg font-medium text-gray-900 mb-4">Altri Dati Profilo</h3>

						<dl class="grid grid-cols-1 md:grid-cols-2 gap-4">
							<div>
								<dt class="text-sm font-medium text-gray-500">Data di Nascita</dt>
								<dd class="mt-1 text-sm text-gray-900">
									{data.user.profile.birthDate ? new Date(data.user.profile.birthDate).toLocaleDateString('it-IT') : '-'}
								</dd>
							</div>

							<div>
								<dt class="text-sm font-medium text-gray-500">Codice Fiscale</dt>
								<dd class="mt-1 text-sm text-gray-900">{data.user.profile.taxCode || '-'}</dd>
							</div>

							<div class="md:col-span-2">
								<dt class="text-sm font-medium text-gray-500">Indirizzo</dt>
								<dd class="mt-1 text-sm text-gray-900">
									{data.user.profile.address}, {data.user.profile.postalCode}
									{data.user.profile.city} ({data.user.profile.province})
								</dd>
							</div>
						</dl>
					</div>
				{/if}
			{:else}
				<div class="text-center py-8 text-gray-500">
					<p>L'utente non ha ancora completato il profilo.</p>
					<p class="text-sm mt-2">Puoi creare un profilo base compilando i campi qui sotto.</p>

					<form
						method="POST"
						action="?/update"
						class="mt-6 max-w-md mx-auto"
						use:enhance={() => {
							loading = true;
							return async ({ update }) => {
								await update({ invalidateAll: true, reset: false });
								loading = false;
							};
						}}
					>
						<Input
							name="firstName"
							label="Nome"
							type="text"
							value={form?.values?.firstName || ''}
							error={form?.errors?.firstName}
							required
						/>

						<Input
							name="lastName"
							label="Cognome"
							type="text"
							value={form?.values?.lastName || ''}
							error={form?.errors?.lastName}
							required
						/>

						<Button type="submit" variant="primary" {loading} fullWidth>
							{loading ? 'Creazione...' : 'Crea Profilo'}
						</Button>
					</form>
				</div>
			{/if}
		</div>
</div>
