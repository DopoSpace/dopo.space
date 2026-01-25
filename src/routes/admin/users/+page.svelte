<script lang="ts">
	import { goto } from '$app/navigation';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	// Selection state
	let selectedUserIds = $state<Set<string>>(new Set());

	// Filter panel visibility
	let showFilters = $state(data.hasActiveFilters);

	// Sort fields that are sortable
	type SortField = 'email' | 'firstName' | 'lastName' | 'membershipNumber' | 'status' | 'startDate' | 'endDate' | 'createdAt';
	const sortableFields: SortField[] = ['email', 'firstName', 'lastName', 'membershipNumber', 'status', 'startDate', 'endDate', 'createdAt'];

	// Filter state - initialized from server data
	let filterStatus = $state(data.filters.status);
	let filterRegisteredFrom = $state(data.filters.registeredFrom);
	let filterRegisteredTo = $state(data.filters.registeredTo);
	let filterStartDateFrom = $state(data.filters.startDateFrom);
	let filterStartDateTo = $state(data.filters.startDateTo);
	let filterEndDateFrom = $state(data.filters.endDateFrom);
	let filterEndDateTo = $state(data.filters.endDateTo);

	// Status options for dropdown
	const statusOptions = [
		{ value: '', label: 'Tutti gli stati' },
		{ value: 'active', label: 'Attivo' },
		{ value: 'awaiting_card', label: 'Pagato - In attesa tessera' },
		{ value: 'awaiting_payment', label: 'In attesa di pagamento' },
		{ value: 'payment_failed', label: 'Pagamento non riuscito' },
		{ value: 'expired', label: 'Scaduto' },
		{ value: 'canceled', label: 'Cancellato' },
		{ value: 'not_member', label: 'Non iscritto' }
	];

	// Derived states
	let allSelected = $derived(
		data.users.length > 0 && selectedUserIds.size === data.users.length
	);
	let someSelected = $derived(
		selectedUserIds.size > 0 && selectedUserIds.size < data.users.length
	);
	let selectionCount = $derived(selectedUserIds.size);

	// Count active filters for badge
	let activeFilterCount = $derived(() => {
		let count = 0;
		if (filterStatus) count++;
		if (filterRegisteredFrom || filterRegisteredTo) count++;
		if (filterStartDateFrom || filterStartDateTo) count++;
		if (filterEndDateFrom || filterEndDateTo) count++;
		return count;
	});

	function applyFilters() {
		const params = new URLSearchParams();

		// Keep search if present
		if (data.search) params.set('search', data.search);

		// Add filters
		if (filterStatus) params.set('status', filterStatus);
		if (filterRegisteredFrom) params.set('registeredFrom', filterRegisteredFrom);
		if (filterRegisteredTo) params.set('registeredTo', filterRegisteredTo);
		if (filterStartDateFrom) params.set('startDateFrom', filterStartDateFrom);
		if (filterStartDateTo) params.set('startDateTo', filterStartDateTo);
		if (filterEndDateFrom) params.set('endDateFrom', filterEndDateFrom);
		if (filterEndDateTo) params.set('endDateTo', filterEndDateTo);

		// Preserve sort
		if (data.sort && data.sort !== 'createdAt') params.set('sort', data.sort);
		if (data.order && data.order !== 'desc') params.set('order', data.order);

		selectedUserIds = new Set();
		goto(`/admin/users?${params.toString()}`);
	}

	function clearFilters() {
		filterStatus = '';
		filterRegisteredFrom = '';
		filterRegisteredTo = '';
		filterStartDateFrom = '';
		filterStartDateTo = '';
		filterEndDateFrom = '';
		filterEndDateTo = '';

		const params = new URLSearchParams();
		if (data.search) params.set('search', data.search);

		selectedUserIds = new Set();
		goto(`/admin/users?${params.toString()}`);
	}

	function handleSearch(e: Event) {
		const form = e.target as HTMLFormElement;
		const formData = new FormData(form);
		const search = formData.get('search') as string;

		const params = new URLSearchParams();
		if (search) params.set('search', search);

		// Preserve active filters
		if (filterStatus) params.set('status', filterStatus);
		if (filterRegisteredFrom) params.set('registeredFrom', filterRegisteredFrom);
		if (filterRegisteredTo) params.set('registeredTo', filterRegisteredTo);
		if (filterStartDateFrom) params.set('startDateFrom', filterStartDateFrom);
		if (filterStartDateTo) params.set('startDateTo', filterStartDateTo);
		if (filterEndDateFrom) params.set('endDateFrom', filterEndDateFrom);
		if (filterEndDateTo) params.set('endDateTo', filterEndDateTo);

		// Preserve sort
		if (data.sort && data.sort !== 'createdAt') params.set('sort', data.sort);
		if (data.order && data.order !== 'desc') params.set('order', data.order);

		// Clear selection when searching
		selectedUserIds = new Set();
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

	function buildExportUrl(format: 'csv' | 'xlsx' | 'aics'): string {
		const params = new URLSearchParams();
		params.set('format', format);

		// If users are selected, export only those
		if (selectedUserIds.size > 0) {
			params.set('userIds', Array.from(selectedUserIds).join(','));
		} else {
			// Otherwise use search and filter criteria
			if (data.search) params.set('search', data.search);
			if (data.filters.status) params.set('status', data.filters.status);
			if (data.filters.registeredFrom) params.set('registeredFrom', data.filters.registeredFrom);
			if (data.filters.registeredTo) params.set('registeredTo', data.filters.registeredTo);
			if (data.filters.startDateFrom) params.set('startDateFrom', data.filters.startDateFrom);
			if (data.filters.startDateTo) params.set('startDateTo', data.filters.startDateTo);
			if (data.filters.endDateFrom) params.set('endDateFrom', data.filters.endDateFrom);
			if (data.filters.endDateTo) params.set('endDateTo', data.filters.endDateTo);
		}

		return `/admin/export?${params.toString()}`;
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

	function handleSort(field: SortField) {
		const params = new URLSearchParams();

		// Preserve search
		if (data.search) params.set('search', data.search);

		// Preserve filters
		if (filterStatus) params.set('status', filterStatus);
		if (filterRegisteredFrom) params.set('registeredFrom', filterRegisteredFrom);
		if (filterRegisteredTo) params.set('registeredTo', filterRegisteredTo);
		if (filterStartDateFrom) params.set('startDateFrom', filterStartDateFrom);
		if (filterStartDateTo) params.set('startDateTo', filterStartDateTo);
		if (filterEndDateFrom) params.set('endDateFrom', filterEndDateFrom);
		if (filterEndDateTo) params.set('endDateTo', filterEndDateTo);

		// Toggle sort order if same field, otherwise default to asc
		const newOrder = data.sort === field && data.order === 'asc' ? 'desc' : 'asc';
		params.set('sort', field);
		params.set('order', newOrder);

		selectedUserIds = new Set();
		goto(`/admin/users?${params.toString()}`);
	}

	function getSortIcon(field: SortField): string {
		if (data.sort !== field) return '↕'; // Neutral
		return data.order === 'asc' ? '↑' : '↓';
	}

	function isSortActive(field: SortField): boolean {
		return data.sort === field;
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
						<button
							type="button"
							onclick={() => showFilters = !showFilters}
							class="btn-secondary relative"
						>
							<svg class="h-4 w-4 mr-1.5 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
							</svg>
							Filtri
							{#if activeFilterCount() > 0}
								<span class="absolute -top-1.5 -right-1.5 bg-blue-600 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
									{activeFilterCount()}
								</span>
							{/if}
						</button>
						{#if data.search || data.hasActiveFilters}
							<a href="/admin/users" class="btn-secondary"> Reset tutto </a>
						{/if}
					</div>
				</form>

				<!-- Filter Panel -->
				{#if showFilters}
					<div class="mb-4 p-4 bg-gray-50 border border-gray-200 rounded-lg">
						<!-- Row 1: Status -->
						<div class="mb-4">
							<label for="filterStatus" class="block text-sm font-medium text-gray-700 mb-1">
								Stato
							</label>
							<select
								id="filterStatus"
								bind:value={filterStatus}
								class="input text-gray-900 w-full max-w-xs"
							>
								{#each statusOptions as option}
									<option value={option.value}>{option.label}</option>
								{/each}
							</select>
						</div>

						<!-- Row 2: Date Filters -->
						<div class="grid grid-cols-1 md:grid-cols-3 gap-4">
							<!-- Registration Date Range -->
							<div class="p-3 bg-white border border-gray-200 rounded-lg">
								<label class="block text-sm font-medium text-gray-700 mb-2">
									Data registrazione
								</label>
								<div class="space-y-2">
									<div class="flex items-center gap-2">
										<span class="text-xs text-gray-500 w-6">Da</span>
										<input
											type="date"
											bind:value={filterRegisteredFrom}
											class="input text-gray-900 flex-1 text-sm"
										/>
									</div>
									<div class="flex items-center gap-2">
										<span class="text-xs text-gray-500 w-6">A</span>
										<input
											type="date"
											bind:value={filterRegisteredTo}
											class="input text-gray-900 flex-1 text-sm"
										/>
									</div>
								</div>
							</div>

							<!-- Start Date Range -->
							<div class="p-3 bg-white border border-gray-200 rounded-lg">
								<label class="block text-sm font-medium text-gray-700 mb-2">
									Data inizio tessera
								</label>
								<div class="space-y-2">
									<div class="flex items-center gap-2">
										<span class="text-xs text-gray-500 w-6">Da</span>
										<input
											type="date"
											bind:value={filterStartDateFrom}
											class="input text-gray-900 flex-1 text-sm"
										/>
									</div>
									<div class="flex items-center gap-2">
										<span class="text-xs text-gray-500 w-6">A</span>
										<input
											type="date"
											bind:value={filterStartDateTo}
											class="input text-gray-900 flex-1 text-sm"
										/>
									</div>
								</div>
							</div>

							<!-- End Date Range -->
							<div class="p-3 bg-white border border-gray-200 rounded-lg">
								<label class="block text-sm font-medium text-gray-700 mb-2">
									Data scadenza tessera
								</label>
								<div class="space-y-2">
									<div class="flex items-center gap-2">
										<span class="text-xs text-gray-500 w-6">Da</span>
										<input
											type="date"
											bind:value={filterEndDateFrom}
											class="input text-gray-900 flex-1 text-sm"
										/>
									</div>
									<div class="flex items-center gap-2">
										<span class="text-xs text-gray-500 w-6">A</span>
										<input
											type="date"
											bind:value={filterEndDateTo}
											class="input text-gray-900 flex-1 text-sm"
										/>
									</div>
								</div>
							</div>
						</div>

						<!-- Filter Actions -->
						<div class="flex justify-end gap-2 mt-4 pt-3 border-t border-gray-200">
							{#if data.hasActiveFilters}
								<button
									type="button"
									onclick={clearFilters}
									class="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800"
								>
									Cancella filtri
								</button>
							{/if}
							<button
								type="button"
								onclick={applyFilters}
								class="btn-primary text-sm"
							>
								Applica filtri
							</button>
						</div>
					</div>
				{/if}

				<!-- Active Filters Summary -->
				{#if data.hasActiveFilters && !showFilters}
					<div class="mb-4 p-2 bg-blue-50 border border-blue-200 rounded-lg flex items-center gap-2 flex-wrap">
						<span class="text-sm text-blue-800 font-medium">Filtri attivi:</span>
						{#if data.filters.status}
							<span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
								{statusOptions.find(o => o.value === data.filters.status)?.label || data.filters.status}
							</span>
						{/if}
						{#if data.filters.registeredFrom || data.filters.registeredTo}
							<span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
								Registrazione: {data.filters.registeredFrom || '...'} - {data.filters.registeredTo || '...'}
							</span>
						{/if}
						{#if data.filters.startDateFrom || data.filters.startDateTo}
							<span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
								Inizio: {data.filters.startDateFrom || '...'} - {data.filters.startDateTo || '...'}
							</span>
						{/if}
						{#if data.filters.endDateFrom || data.filters.endDateTo}
							<span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
								Scadenza: {data.filters.endDateFrom || '...'} - {data.filters.endDateTo || '...'}
							</span>
						{/if}
						<button
							type="button"
							onclick={() => showFilters = true}
							class="text-xs text-blue-600 hover:text-blue-800 underline ml-auto"
						>
							Modifica
						</button>
					</div>
				{/if}

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
				<div class="table-container">
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
									class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none {isSortActive('email') ? 'text-blue-600' : 'text-gray-500'}"
									onclick={() => handleSort('email')}
								>
									Email <span class="ml-1">{getSortIcon('email')}</span>
								</th>
								<th
									class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none {isSortActive('firstName') ? 'text-blue-600' : 'text-gray-500'}"
									onclick={() => handleSort('firstName')}
								>
									Nome <span class="ml-1">{getSortIcon('firstName')}</span>
								</th>
								<th
									class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none {isSortActive('lastName') ? 'text-blue-600' : 'text-gray-500'}"
									onclick={() => handleSort('lastName')}
								>
									Cognome <span class="ml-1">{getSortIcon('lastName')}</span>
								</th>
								<th
									class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none {isSortActive('membershipNumber') ? 'text-blue-600' : 'text-gray-500'}"
									onclick={() => handleSort('membershipNumber')}
								>
									N. Tessera <span class="ml-1">{getSortIcon('membershipNumber')}</span>
								</th>
								<th
									class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none {isSortActive('status') ? 'text-blue-600' : 'text-gray-500'}"
									onclick={() => handleSort('status')}
								>
									Status <span class="ml-1">{getSortIcon('status')}</span>
								</th>
								<th
									class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none {isSortActive('startDate') ? 'text-blue-600' : 'text-gray-500'}"
									onclick={() => handleSort('startDate')}
								>
									Inizio <span class="ml-1">{getSortIcon('startDate')}</span>
								</th>
								<th
									class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none {isSortActive('endDate') ? 'text-blue-600' : 'text-gray-500'}"
									onclick={() => handleSort('endDate')}
								>
									Scadenza <span class="ml-1">{getSortIcon('endDate')}</span>
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
									onclick={() => goto(`/admin/users/${user.id}`)}
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
											<span
												class="status-badge bg-gray-100 text-gray-600"
												data-tooltip="L'utente si è registrato ma non ha ancora iniziato la procedura di iscrizione"
											>
												Non iscritto
											</span>
										{:else if user.membershipStatus === 'EXPIRED'}
											<span
												class="status-badge bg-orange-100 text-orange-800"
												data-tooltip="La tessera è scaduta. Il numero tessera è stato archiviato."
											>
												Scaduto
											</span>
										{:else if user.membershipStatus === 'CANCELED'}
											<span
												class="status-badge bg-red-100 text-red-800"
												data-tooltip="La tessera è stata annullata da un amministratore"
											>
												Cancellato
											</span>
										{:else if user.paymentStatus === 'SUCCEEDED' && user.membershipNumber}
											<span
												class="status-badge bg-green-100 text-green-800"
												data-tooltip="Tessera attiva e regolare. L'utente è un membro a tutti gli effetti."
											>
												Attivo
											</span>
										{:else if user.paymentStatus === 'SUCCEEDED'}
											<span
												class="status-badge bg-yellow-100 text-yellow-800"
												data-tooltip="Pagamento ricevuto. In attesa che un admin assegni il numero tessera."
											>
												Pagato - In attesa tessera
											</span>
										{:else if user.paymentStatus === 'PENDING'}
											<span
												class="status-badge bg-blue-100 text-blue-800"
												data-tooltip="L'utente ha completato il profilo e deve ancora effettuare il pagamento"
											>
												In attesa di pagamento
											</span>
										{:else if user.paymentStatus === 'FAILED' || user.paymentStatus === 'CANCELED'}
											<span
												class="status-badge bg-red-100 text-red-800"
												data-tooltip="Il pagamento non è andato a buon fine (fallito o annullato). L'utente può riprovare."
											>
												Pagamento non riuscito
											</span>
										{:else}
											<span
												class="status-badge bg-gray-100 text-gray-600"
												data-tooltip="Stato membership: {user.membershipStatus}"
											>
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
</div>

<style>
	.table-container {
		overflow-x: auto;
		overflow-y: visible;
		padding-top: 60px;
		margin-top: -60px;
	}

	.status-badge {
		position: relative;
		display: inline-flex;
		align-items: center;
		padding: 0.125rem 0.625rem;
		border-radius: 9999px;
		font-size: 0.75rem;
		font-weight: 500;
		cursor: help;
	}

	/* Custom tooltip styling */
	.status-badge[data-tooltip]::after {
		content: attr(data-tooltip);
		position: absolute;
		bottom: calc(100% + 8px);
		left: 50%;
		transform: translateX(-50%);
		padding: 0.625rem 0.875rem;
		background-color: #1f2937;
		color: white;
		font-size: 0.8125rem;
		font-weight: 400;
		line-height: 1.5;
		border-radius: 0.5rem;
		width: 300px;
		white-space: normal;
		word-wrap: break-word;
		text-align: center;
		opacity: 0;
		visibility: hidden;
		transition: opacity 0.15s ease, visibility 0.15s ease;
		z-index: 9999;
		box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1);
		pointer-events: none;
	}

	/* Tooltip arrow */
	.status-badge[data-tooltip]::before {
		content: '';
		position: absolute;
		bottom: calc(100% + 2px);
		left: 50%;
		transform: translateX(-50%);
		border: 6px solid transparent;
		border-top-color: #1f2937;
		opacity: 0;
		visibility: hidden;
		transition: opacity 0.15s ease, visibility 0.15s ease;
		z-index: 9999;
		pointer-events: none;
	}

	.status-badge[data-tooltip]:hover::after,
	.status-badge[data-tooltip]:hover::before {
		opacity: 1;
		visibility: visible;
	}
</style>
