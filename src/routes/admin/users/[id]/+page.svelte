<script lang="ts">
	import { enhance } from '$app/forms';
	import Input from '$lib/components/forms/Input.svelte';
	import Button from '$lib/components/forms/Button.svelte';
	import ErrorMessage from '$lib/components/forms/ErrorMessage.svelte';
	import type { PageData, ActionData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
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

<div class="min-h-screen bg-gray-50">
	<!-- Header -->
	<header class="bg-white border-b border-gray-200">
		<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
			<div class="flex justify-between items-center">
				<div>
					<h1 class="text-2xl font-bold text-gray-900">Dettaglio Utente</h1>
					<p class="text-sm text-gray-600">Admin: {data.admin.email}</p>
				</div>
				<a href="/admin/users" class="text-blue-600 hover:text-blue-800 underline">
					Torna alla lista
				</a>
			</div>
		</div>
	</header>

	<!-- Main Content -->
	<main class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
									{new Date(data.user.profile.birthDate).toLocaleDateString('it-IT')}
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
	</main>
</div>
