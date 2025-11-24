<script lang="ts">
	import { goto } from '$app/navigation';
	import { enhance } from '$app/forms';
	import type { PageData, ActionData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	// Batch assignment state
	let showBatchSection = $state(false);
	let selectedUserIds = $state<string[]>([]);
	let loading = $state(false);

	// Reactive: select all checkbox state
	let allSelected = $derived(
		data.usersAwaitingCard.length > 0 &&
		selectedUserIds.length === data.usersAwaitingCard.length
	);

	function handleSearch(e: Event) {
		const form = e.target as HTMLFormElement;
		const formData = new FormData(form);
		const search = formData.get('search') as string;

		const params = new URLSearchParams();
		if (search) {
			params.set('search', search);
		}

		goto(`/admin/users?${params.toString()}`);
	}

	function formatDate(isoString: string | null): string {
		if (!isoString) return '-';
		return new Date(isoString).toLocaleDateString('it-IT', {
			year: 'numeric',
			month: 'long',
			day: 'numeric'
		});
	}

	function buildExportUrl(format: 'csv' | 'xlsx'): string {
		const params = new URLSearchParams();
		params.set('format', format);
		if (data.search) {
			params.set('search', data.search);
		}
		return `/admin/export?${params.toString()}`;
	}

	function toggleSelectAll() {
		if (allSelected) {
			selectedUserIds = [];
		} else {
			selectedUserIds = data.usersAwaitingCard.map((u) => u.id);
		}
	}

	function toggleUser(userId: string) {
		if (selectedUserIds.includes(userId)) {
			selectedUserIds = selectedUserIds.filter((id) => id !== userId);
		} else {
			selectedUserIds = [...selectedUserIds, userId];
		}
	}
</script>

<div class="min-h-screen bg-gray-50">
	<!-- Header -->
	<header class="bg-white border-b border-gray-200">
		<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
			<div class="flex justify-between items-center">
				<div>
					<h1 class="text-2xl font-bold text-gray-900">Admin Panel</h1>
					<p class="text-sm text-gray-600">Logged in as: {data.admin.email}</p>
				</div>
				<a href="/" class="text-blue-600 hover:text-blue-800 underline"> Torna alla home </a>
			</div>
		</div>
	</header>

	<!-- Main Content -->
	<main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
		<div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
			<div class="mb-6">
				<h2 class="text-xl font-bold text-gray-900 mb-4">Utenti Registrati</h2>

				<!-- Search Form -->
				<form onsubmit={handleSearch} class="mb-4">
					<div class="flex gap-2">
						<input
							type="text"
							name="search"
							value={data.search}
							placeholder="Cerca per email, nome o cognome..."
							class="input text-gray-900 flex-1"
						/>
						<button type="submit" class="btn-primary"> Cerca </button>
						{#if data.search}
							<a href="/admin/users" class="btn-secondary"> Reset </a>
						{/if}
					</div>
				</form>

				<!-- Export Buttons -->
				<div class="flex gap-2 mb-4">
					<a
						href={buildExportUrl('csv')}
						class="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
					>
						<svg
							class="mr-2 h-4 w-4"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
							/>
						</svg>
						Esporta CSV
					</a>
					<a
						href={buildExportUrl('xlsx')}
						class="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
					>
						<svg
							class="mr-2 h-4 w-4"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
							/>
						</svg>
						Esporta Excel
					</a>
				</div>

				<!-- Results Count -->
				<p class="text-sm text-gray-600 mb-4">
					{data.users.length} {data.users.length === 1 ? 'utente trovato' : 'utenti trovati'}
				</p>
			</div>

			<!-- Users Table -->
			{#if data.users.length === 0}
				<div class="text-center py-12">
					<p class="text-gray-500 text-lg">Nessun utente trovato</p>
				</div>
			{:else}
				<div class="overflow-x-auto">
					<table class="min-w-full divide-y divide-gray-200">
						<thead class="bg-gray-50">
							<tr>
								<th
									class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
								>
									Email
								</th>
								<th
									class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
								>
									Nome
								</th>
								<th
									class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
								>
									Cognome
								</th>
								<th
									class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
								>
									Data Registrazione
								</th>
								<th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
									Azioni
								</th>
							</tr>
						</thead>
						<tbody class="bg-white divide-y divide-gray-200">
							{#each data.users as user (user.id)}
								<tr class="hover:bg-gray-50 cursor-pointer" onclick={() => goto(`/admin/users/${user.id}`)}>
									<td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
										{user.email}
									</td>
									<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
										{user.firstName}
									</td>
									<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
										{user.lastName}
									</td>
									<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
										{formatDate(user.createdAt)}
									</td>
									<td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
										<a
											href="/admin/users/{user.id}"
											class="text-blue-600 hover:text-blue-900"
											onclick={(e) => e.stopPropagation()}
										>
											Dettagli
										</a>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}
		</div>

		<!-- Batch Card Assignment Section -->
		<div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mt-6">
			<button
				type="button"
				class="flex items-center justify-between w-full text-left"
				onclick={() => (showBatchSection = !showBatchSection)}
			>
				<h2 class="text-xl font-bold text-gray-900">
					Assegnazione Batch Tessere
					{#if data.usersAwaitingCard.length > 0}
						<span class="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
							{data.usersAwaitingCard.length} in attesa
						</span>
					{/if}
				</h2>
				<svg
					class="h-5 w-5 text-gray-500 transition-transform {showBatchSection ? 'rotate-180' : ''}"
					fill="none"
					stroke="currentColor"
					viewBox="0 0 24 24"
				>
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
				</svg>
			</button>

			{#if showBatchSection}
				<div class="mt-6">
					<!-- Success Result -->
					{#if form?.success && form?.result}
						<div class="mb-6 rounded-lg border border-green-200 bg-green-50 p-4">
							<h3 class="text-lg font-semibold text-green-800 mb-3">Assegnazione completata</h3>
							<ul class="space-y-2 text-sm text-green-700">
								<li>
									<strong>Tessere assegnate:</strong> {form.result.assigned.length}
									{#if form.result.assigned.length > 0}
										<ul class="ml-4 mt-1 text-xs">
											{#each form.result.assigned as a}
												<li>{a.email} → {a.membershipNumber}</li>
											{/each}
										</ul>
									{/if}
								</li>
								{#if form.result.skipped.length > 0}
									<li class="text-yellow-700">
										<strong>Tessere skippate (già esistenti):</strong> {form.result.skipped.join(', ')}
									</li>
								{/if}
								{#if form.result.remaining.length > 0}
									<li>
										<strong>Tessere avanzate:</strong> {form.result.remaining.length}
										<span class="text-xs">({form.result.remaining[0]} - {form.result.remaining[form.result.remaining.length - 1]})</span>
									</li>
								{/if}
								{#if form.result.usersWithoutCard.length > 0}
									<li class="text-red-700">
										<strong>Utenti rimasti senza tessera:</strong> {form.result.usersWithoutCard.length}
										<ul class="ml-4 mt-1 text-xs">
											{#each form.result.usersWithoutCard as u}
												<li>{u.email}</li>
											{/each}
										</ul>
									</li>
								{/if}
							</ul>
						</div>
					{/if}

					<!-- Error Message -->
					{#if form?.errors?._form}
						<div class="mb-6 rounded-lg border border-red-200 bg-red-50 p-4">
							<p class="text-sm text-red-700">{form.errors._form}</p>
						</div>
					{/if}

					{#if data.usersAwaitingCard.length === 0}
						<div class="text-center py-8 text-gray-500">
							<p>Nessun utente in attesa di assegnazione tessera.</p>
							<p class="text-sm mt-1">Gli utenti appariranno qui dopo aver completato il pagamento.</p>
						</div>
					{:else}
						<form
							method="POST"
							action="?/assignCards"
							use:enhance={() => {
								loading = true;
								return async ({ update }) => {
									await update({ invalidateAll: true, reset: false });
									loading = false;
									selectedUserIds = [];
								};
							}}
						>
							<!-- Card Number Range Inputs -->
							<div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
								<div>
									<label for="prefix" class="label">Prefisso (opzionale)</label>
									<input
										type="text"
										id="prefix"
										name="prefix"
										value={form?.values?.prefix || ''}
										placeholder="es. DOPO-"
										class="input text-gray-900"
									/>
									{#if form?.errors?.prefix}
										<p class="text-sm text-red-600 mt-1">{form.errors.prefix}</p>
									{/if}
								</div>
								<div>
									<label for="startNumber" class="label">Numero Inizio</label>
									<input
										type="text"
										id="startNumber"
										name="startNumber"
										value={form?.values?.startNumber || ''}
										placeholder="es. 001"
										required
										class="input text-gray-900"
									/>
									{#if form?.errors?.startNumber}
										<p class="text-sm text-red-600 mt-1">{form.errors.startNumber}</p>
									{/if}
								</div>
								<div>
									<label for="endNumber" class="label">Numero Fine</label>
									<input
										type="text"
										id="endNumber"
										name="endNumber"
										value={form?.values?.endNumber || ''}
										placeholder="es. 050"
										required
										class="input text-gray-900"
									/>
									{#if form?.errors?.endNumber}
										<p class="text-sm text-red-600 mt-1">{form.errors.endNumber}</p>
									{/if}
								</div>
							</div>

							{#if form?.errors?.userIds}
								<p class="text-sm text-red-600 mb-4">{form.errors.userIds}</p>
							{/if}

							<!-- Users Table with Checkboxes -->
							<div class="overflow-x-auto mb-4">
								<table class="min-w-full divide-y divide-gray-200">
									<thead class="bg-gray-50">
										<tr>
											<th class="px-4 py-3 text-left">
												<input
													type="checkbox"
													checked={allSelected}
													onchange={toggleSelectAll}
													class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
												/>
											</th>
											<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
												Email
											</th>
											<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
												Nome
											</th>
											<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
												Cognome
											</th>
											<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
												Data Pagamento
											</th>
										</tr>
									</thead>
									<tbody class="bg-white divide-y divide-gray-200">
										{#each data.usersAwaitingCard as user (user.id)}
											<tr class="hover:bg-gray-50">
												<td class="px-4 py-3">
													<input
														type="checkbox"
														name="userIds"
														value={user.id}
														checked={selectedUserIds.includes(user.id)}
														onchange={() => toggleUser(user.id)}
														class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
													/>
												</td>
												<td class="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
													{user.email}
												</td>
												<td class="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
													{user.firstName}
												</td>
												<td class="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
													{user.lastName}
												</td>
												<td class="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
													{formatDate(user.paymentDate)}
												</td>
											</tr>
										{/each}
									</tbody>
								</table>
							</div>

							<!-- Selection Count and Submit -->
							<div class="flex items-center justify-between">
								<p class="text-sm text-gray-600">
									{selectedUserIds.length} utenti selezionati
								</p>
								<button
									type="submit"
									disabled={loading || selectedUserIds.length === 0}
									class="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
								>
									{#if loading}
										<svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white inline" fill="none" viewBox="0 0 24 24">
											<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
											<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
										</svg>
										Assegnazione in corso...
									{:else}
										Assegna Tessere
									{/if}
								</button>
							</div>
						</form>
					{/if}
				</div>
			{/if}
		</div>
	</main>
</div>
