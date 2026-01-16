<script lang="ts">
	import { goto } from '$app/navigation';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	// Selection state
	let selectedUserIds = $state<Set<string>>(new Set());

	// Derived states
	let allSelected = $derived(
		data.users.length > 0 && selectedUserIds.size === data.users.length
	);
	let someSelected = $derived(
		selectedUserIds.size > 0 && selectedUserIds.size < data.users.length
	);
	let selectionCount = $derived(selectedUserIds.size);

	function handleSearch(e: Event) {
		const form = e.target as HTMLFormElement;
		const formData = new FormData(form);
		const search = formData.get('search') as string;

		const params = new URLSearchParams();
		if (search) {
			params.set('search', search);
		}

		// Clear selection when searching
		selectedUserIds = new Set();
		goto(`/users?${params.toString()}`);
	}

	function formatDate(isoString: string | null): string {
		if (!isoString) return '-';
		return new Date(isoString).toLocaleDateString('it-IT', {
			year: 'numeric',
			month: 'long',
			day: 'numeric'
		});
	}

	function buildExportUrl(format: 'csv' | 'xlsx' | 'aics'): string {
		const params = new URLSearchParams();
		params.set('format', format);

		// If users are selected, export only those
		if (selectedUserIds.size > 0) {
			params.set('userIds', Array.from(selectedUserIds).join(','));
		} else if (data.search) {
			// Otherwise use search filter
			params.set('search', data.search);
		}

		return `/export?${params.toString()}`;
	}

	function toggleSelectAll() {
		if (allSelected) {
			selectedUserIds = new Set();
		} else {
			selectedUserIds = new Set(data.users.map(u => u.id));
		}
	}

	function toggleUserSelection(userId: string, event: Event) {
		event.stopPropagation();
		const newSet = new Set(selectedUserIds);
		if (newSet.has(userId)) {
			newSet.delete(userId);
		} else {
			newSet.add(userId);
		}
		selectedUserIds = newSet;
	}

	function clearSelection() {
		selectedUserIds = new Set();
	}
</script>

<div class="space-y-6">
	<!-- Page Header -->
	<div>
		<h1 class="text-2xl font-bold text-gray-900">Utenti</h1>
		<p class="text-sm text-gray-600 mt-1">Gestisci gli utenti registrati e le loro tessere</p>
	</div>

	<!-- Main Content -->
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
							<a href="/users" class="btn-secondary"> Reset </a>
						{/if}
					</div>
				</form>

				<!-- Selection Bar -->
				{#if selectionCount > 0}
					<div class="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-between">
						<div class="flex items-center gap-2">
							<span class="text-sm font-medium text-blue-800">
								{selectionCount} {selectionCount === 1 ? 'utente selezionato' : 'utenti selezionati'}
							</span>
							<button
								type="button"
								onclick={clearSelection}
								class="text-sm text-blue-600 hover:text-blue-800 underline"
							>
								Deseleziona tutti
							</button>
						</div>
						<div class="flex gap-2">
							<a
								href={buildExportUrl('csv')}
								class="inline-flex items-center px-3 py-1.5 border border-blue-300 rounded-md text-sm font-medium text-blue-700 bg-white hover:bg-blue-50"
							>
								<svg class="mr-1.5 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
								</svg>
								CSV
							</a>
							<a
								href={buildExportUrl('xlsx')}
								class="inline-flex items-center px-3 py-1.5 border border-blue-300 rounded-md text-sm font-medium text-blue-700 bg-white hover:bg-blue-50"
							>
								<svg class="mr-1.5 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
								</svg>
								Excel
							</a>
							<a
								href={buildExportUrl('aics')}
								class="inline-flex items-center px-3 py-1.5 border border-green-300 rounded-md text-sm font-medium text-green-700 bg-white hover:bg-green-50"
							>
								<svg class="mr-1.5 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
								</svg>
								AICS
							</a>
						</div>
					</div>
				{:else}
					<!-- Export Buttons (when nothing selected) -->
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
							Esporta tutti CSV
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
							Esporta tutti Excel
						</a>
						<a
							href={buildExportUrl('aics')}
							class="inline-flex items-center px-4 py-2 border border-green-300 rounded-md shadow-sm text-sm font-medium text-green-700 bg-white hover:bg-green-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
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
									d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
								/>
							</svg>
							Esporta AICS
						</a>
					</div>
				{/if}

				<!-- Results Count -->
				<p class="text-sm text-gray-600 mb-4">
					{data.users.length} {data.users.length === 1 ? 'utente trovato' : 'utenti trovati'}
					{#if selectionCount > 0}
						<span class="text-blue-600">({selectionCount} selezionati)</span>
					{/if}
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
								<th class="px-4 py-3 text-left">
									<input
										type="checkbox"
										checked={allSelected}
										indeterminate={someSelected}
										onchange={toggleSelectAll}
										class="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
									/>
								</th>
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
									N. Tessera
								</th>
								<th
									class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
								>
									Status
								</th>
								<th
									class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
								>
									Inizio
								</th>
								<th
									class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
								>
									Scadenza
								</th>
								<th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
									Azioni
								</th>
							</tr>
						</thead>
						<tbody class="bg-white divide-y divide-gray-200">
							{#each data.users as user (user.id)}
								<tr
									class="hover:bg-gray-50 cursor-pointer {selectedUserIds.has(user.id) ? 'bg-blue-50' : ''}"
									onclick={() => goto(`/users/${user.id}`)}
								>
									<td class="px-4 py-4 whitespace-nowrap">
										<input
											type="checkbox"
											checked={selectedUserIds.has(user.id)}
											onchange={(e) => toggleUserSelection(user.id, e)}
											onclick={(e) => e.stopPropagation()}
											class="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
										/>
									</td>
									<td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
										{user.email}
									</td>
									<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
										{user.firstName}
									</td>
									<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
										{user.lastName}
									</td>
									<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
										{#if user.membershipNumber}
											<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
												{user.membershipNumber}
											</span>
										{:else}
											<span class="text-gray-400">-</span>
										{/if}
									</td>
									<td class="px-6 py-4 whitespace-nowrap text-sm">
										{#if !user.membershipStatus}
											<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
												Non iscritto
											</span>
										{:else if user.paymentStatus === 'SUCCEEDED' && user.membershipNumber}
											<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
												Attivo
											</span>
										{:else if user.paymentStatus === 'SUCCEEDED'}
											<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
												Pagato - In attesa tessera
											</span>
										{:else if user.paymentStatus === 'PENDING'}
											<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
												In attesa di pagamento
											</span>
										{:else if user.paymentStatus === 'FAILED'}
											<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
												Pagamento fallito
											</span>
										{:else if user.paymentStatus === 'CANCELED'}
											<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
												Annullato
											</span>
										{:else}
											<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
												{user.membershipStatus}
											</span>
										{/if}
									</td>
									<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
										{formatDate(user.startDate)}
									</td>
									<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
										{formatDate(user.endDate)}
									</td>
									<td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
										<a
											href="/users/{user.id}"
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
</div>
