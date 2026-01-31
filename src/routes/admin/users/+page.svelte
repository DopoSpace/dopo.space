<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
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
		{ value: 'awaiting_payment', label: 'Pagamento in corso' },
		{ value: 'payment_failed', label: 'Pagamento non riuscito' },
		{ value: 'expired', label: 'Scaduto' },
		{ value: 'canceled', label: 'Cancellato' },
		{ value: 'not_member', label: 'Non iscritto' }
	];

	// Derived states
	let allPageSelected = $derived(
		data.users.length > 0 && data.users.every(u => selectedUserIds.has(u.id))
	);
	let allSelected = $derived(
		data.allUserIds.length > 0 && selectedUserIds.size === data.allUserIds.length
	);
	let someSelected = $derived(
		selectedUserIds.size > 0 && !allSelected
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

	function goToPage(page: number) {
		const params = new URLSearchParams();

		// Preserve search
		if (data.search) params.set('search', data.search);

		// Preserve filters
		if (data.filters.status) params.set('status', data.filters.status);
		if (data.filters.registeredFrom) params.set('registeredFrom', data.filters.registeredFrom);
		if (data.filters.registeredTo) params.set('registeredTo', data.filters.registeredTo);
		if (data.filters.startDateFrom) params.set('startDateFrom', data.filters.startDateFrom);
		if (data.filters.startDateTo) params.set('startDateTo', data.filters.startDateTo);
		if (data.filters.endDateFrom) params.set('endDateFrom', data.filters.endDateFrom);
		if (data.filters.endDateTo) params.set('endDateTo', data.filters.endDateTo);

		// Preserve sort
		if (data.sort && data.sort !== 'createdAt') params.set('sort', data.sort);
		if (data.order && data.order !== 'desc') params.set('order', data.order);

		// Set page
		if (page > 1) params.set('page', page.toString());

		goto(`/admin/users?${params.toString()}`);
	}

	function getPaginationRange(currentPage: number, totalPages: number): (number | '...')[] {
		const delta = 2;
		const range: (number | '...')[] = [];

		for (let i = 1; i <= totalPages; i++) {
			if (
				i === 1 ||
				i === totalPages ||
				(i >= currentPage - delta && i <= currentPage + delta)
			) {
				range.push(i);
			} else if (range[range.length - 1] !== '...') {
				range.push('...');
			}
		}

		return range;
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

	let isExporting = $state(false);

	// Bulk start date state
	let showDatePicker = $state(false);
	let bulkStartDate = $state('');
	let isBulkUpdating = $state(false);
	let bulkFeedback = $state<{ type: 'success' | 'error'; message: string } | null>(null);

	async function handleBulkStartDateUpdate() {
		if (isBulkUpdating || !bulkStartDate) return;
		isBulkUpdating = true;
		bulkFeedback = null;

		try {
			const response = await fetch('/admin/users/bulk-start-date', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					userIds: Array.from(selectedUserIds),
					startDate: bulkStartDate
				})
			});

			const result = await response.json();

			if (!response.ok || !result.success) {
				bulkFeedback = { type: 'error', message: result.error || 'Errore durante l\'aggiornamento.' };
				return;
			}

			const parts: string[] = [];
			if (result.updated > 0) {
				parts.push(`${result.updated} ${result.updated === 1 ? 'utente aggiornato' : 'utenti aggiornati'}`);
			}
			if (result.skipped > 0) {
				parts.push(`${result.skipped} senza tessera (ignorati)`);
			}
			bulkFeedback = { type: 'success', message: parts.join(', ') + '.' };

			showDatePicker = false;
			bulkStartDate = '';
			await invalidateAll();
		} catch {
			bulkFeedback = { type: 'error', message: 'Errore di rete. Riprova.' };
		} finally {
			isBulkUpdating = false;
		}
	}

	async function handleExport(format: 'csv' | 'xlsx' | 'aics') {
		if (isExporting) return;
		isExporting = true;

		try {
			const response = await fetch('/admin/export', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					format,
					userIds: Array.from(selectedUserIds)
				})
			});

			if (!response.ok) {
				throw new Error('Export failed');
			}

			// Get filename from Content-Disposition header
			const contentDisposition = response.headers.get('Content-Disposition');
			const filenameMatch = contentDisposition?.match(/filename="(.+)"/);
			const filename = filenameMatch?.[1] || `export.${format === 'aics' ? 'xlsx' : format}`;

			// Download the file
			const blob = await response.blob();
			const url = URL.createObjectURL(blob);
			const link = document.createElement('a');
			link.href = url;
			link.download = filename;
			document.body.appendChild(link);
			link.click();
			document.body.removeChild(link);
			URL.revokeObjectURL(url);
		} catch (error) {
			console.error('Export error:', error);
			alert('Errore durante l\'export. Riprova.');
		} finally {
			isExporting = false;
		}
	}

	function toggleSelectPage() {
		if (allPageSelected) {
			// Deselect users on current page
			const pageIds = new Set(data.users.map(u => u.id));
			selectedUserIds = new Set([...selectedUserIds].filter(id => !pageIds.has(id)));
		} else {
			// Select all users on current page
			selectedUserIds = new Set([...selectedUserIds, ...data.users.map(u => u.id)]);
		}
	}

	function selectAllUsers() {
		selectedUserIds = new Set(data.allUserIds);
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

	<!-- Status Summary (collapsible) -->
	{#if data.statusCounts}
		<details class="bg-white rounded-lg shadow-sm border border-gray-200">
			<summary class="px-4 py-3 cursor-pointer hover:bg-gray-50 flex items-center justify-between">
				<span class="font-medium text-gray-900">
					Riepilogo stati ({data.statusCounts.total} utenti totali)
				</span>
				<svg class="h-5 w-5 text-gray-500 transform transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
				</svg>
			</summary>
			<div class="px-4 pb-4 pt-2 border-t border-gray-100">
				<div class="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
					<a href="/admin/users?status=active" class="p-3 bg-green-50 rounded-lg text-center hover:bg-green-100 transition-colors">
						<p class="text-2xl font-bold text-green-700">{data.statusCounts.active}</p>
						<p class="text-xs text-green-600">Attivi</p>
					</a>
					<a href="/admin/users?status=awaiting_card" class="p-3 bg-amber-50 rounded-lg text-center hover:bg-amber-100 transition-colors">
						<p class="text-2xl font-bold text-amber-700">{data.statusCounts.awaitingCard}</p>
						<p class="text-xs text-amber-600">In attesa tessera</p>
					</a>
					<a href="/admin/users?status=awaiting_payment" class="p-3 bg-blue-50 rounded-lg text-center hover:bg-blue-100 transition-colors">
						<p class="text-2xl font-bold text-blue-700">{data.statusCounts.awaitingPayment}</p>
						<p class="text-xs text-blue-600">In attesa pagamento</p>
					</a>
					<a href="/admin/users?status=payment_failed" class="p-3 bg-red-50 rounded-lg text-center hover:bg-red-100 transition-colors">
						<p class="text-2xl font-bold text-red-700">{data.statusCounts.paymentFailed}</p>
						<p class="text-xs text-red-600">Pagamento fallito</p>
					</a>
					<a href="/admin/users?status=expired" class="p-3 bg-gray-50 rounded-lg text-center hover:bg-gray-100 transition-colors">
						<p class="text-2xl font-bold text-gray-700">{data.statusCounts.expired}</p>
						<p class="text-xs text-gray-600">Scaduti</p>
					</a>
					<a href="/admin/users?status=canceled" class="p-3 bg-gray-50 rounded-lg text-center hover:bg-gray-100 transition-colors">
						<p class="text-2xl font-bold text-gray-500">{data.statusCounts.canceled}</p>
						<p class="text-xs text-gray-500">Cancellati</p>
					</a>
					<a href="/admin/users?status=not_member" class="p-3 bg-slate-50 rounded-lg text-center hover:bg-slate-100 transition-colors">
						<p class="text-2xl font-bold text-slate-700">{data.statusCounts.notMember}</p>
						<p class="text-xs text-slate-600">Non iscritti</p>
					</a>
				</div>
			</div>
		</details>
	{/if}

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
							placeholder="Cerca per email, nome, cognome o n° tessera..."
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

				<!-- Bulk Feedback Banner -->
				{#if bulkFeedback}
					<div class="mb-4 p-3 rounded-lg flex items-center justify-between {bulkFeedback.type === 'success' ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}">
						<span class="text-sm font-medium {bulkFeedback.type === 'success' ? 'text-green-800' : 'text-red-800'}">
							{bulkFeedback.message}
						</span>
						<button
							type="button"
							onclick={() => bulkFeedback = null}
							class="text-sm {bulkFeedback.type === 'success' ? 'text-green-600 hover:text-green-800' : 'text-red-600 hover:text-red-800'}"
						>
							<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
							</svg>
						</button>
					</div>
				{/if}

				<!-- Selection Bar -->
				{#if selectionCount > 0}
					<div class="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-between flex-wrap gap-2">
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
						<div class="flex items-center gap-2 flex-wrap">
							<button
								type="button"
								onclick={() => handleExport('csv')}
								disabled={isExporting}
								class="inline-flex items-center px-3 py-1.5 border border-blue-300 rounded-md text-sm font-medium text-blue-700 bg-white hover:bg-blue-50 disabled:opacity-50"
							>
								<svg class="mr-1.5 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
								</svg>
								CSV
							</button>
							<button
								type="button"
								onclick={() => handleExport('xlsx')}
								disabled={isExporting}
								class="inline-flex items-center px-3 py-1.5 border border-blue-300 rounded-md text-sm font-medium text-blue-700 bg-white hover:bg-blue-50 disabled:opacity-50"
							>
								<svg class="mr-1.5 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
								</svg>
								Excel
							</button>
							<button
								type="button"
								onclick={() => handleExport('aics')}
								disabled={isExporting}
								class="inline-flex items-center px-3 py-1.5 border border-green-300 rounded-md text-sm font-medium text-green-700 bg-white hover:bg-green-50 disabled:opacity-50"
							>
								<svg class="mr-1.5 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
								</svg>
								{isExporting ? 'Esportando...' : 'AICS'}
							</button>

							<span class="text-gray-300">|</span>

							{#if !showDatePicker}
								<button
									type="button"
									onclick={() => { showDatePicker = true; bulkFeedback = null; }}
									class="inline-flex items-center px-3 py-1.5 border border-amber-300 rounded-md text-sm font-medium text-amber-700 bg-white hover:bg-amber-50"
								>
									<svg class="mr-1.5 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
									</svg>
									Modifica Data Inizio
								</button>
							{:else}
								<input
									type="date"
									bind:value={bulkStartDate}
									class="input text-gray-900 text-sm px-2 py-1.5"
								/>
								<button
									type="button"
									onclick={handleBulkStartDateUpdate}
									disabled={isBulkUpdating || !bulkStartDate}
									class="inline-flex items-center px-3 py-1.5 border border-amber-300 rounded-md text-sm font-medium text-white bg-amber-600 hover:bg-amber-700 disabled:opacity-50"
								>
									{isBulkUpdating ? 'Aggiornando...' : 'Applica'}
								</button>
								<button
									type="button"
									onclick={() => { showDatePicker = false; bulkStartDate = ''; }}
									disabled={isBulkUpdating}
									class="inline-flex items-center px-3 py-1.5 border border-gray-300 rounded-md text-sm font-medium text-gray-600 bg-white hover:bg-gray-50 disabled:opacity-50"
								>
									Annulla
								</button>
							{/if}
						</div>
					</div>
				{/if}

				<!-- Results Count -->
				<p class="text-sm text-gray-600 mb-4">
					{#if data.pagination.totalCount === data.users.length}
						{data.pagination.totalCount} {data.pagination.totalCount === 1 ? 'utente trovato' : 'utenti trovati'}
					{:else}
						Mostrati {data.users.length} di {data.pagination.totalCount} utenti trovati
					{/if}
					{#if selectionCount > 0}
						<span class="text-blue-600">({selectionCount} selezionati)</span>
					{/if}
				</p>

				<!-- Select All Banner -->
				{#if allPageSelected && !allSelected && data.pagination.totalCount > data.users.length}
					<div class="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-between">
						<p class="text-sm text-blue-800">
							Selezionati tutti i {data.users.length} utenti in questa pagina.
						</p>
						<button
							type="button"
							onclick={selectAllUsers}
							class="text-sm font-medium text-blue-600 hover:text-blue-800 underline"
						>
							Seleziona tutti i {data.pagination.totalCount} utenti
						</button>
					</div>
				{/if}

				<!-- All Selected Banner -->
				{#if allSelected && data.pagination.totalCount > data.users.length}
					<div class="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center justify-between">
						<p class="text-sm text-green-800">
							Selezionati tutti i {data.pagination.totalCount} utenti.
						</p>
						<button
							type="button"
							onclick={clearSelection}
							class="text-sm font-medium text-green-600 hover:text-green-800 underline"
						>
							Deseleziona tutti
						</button>
					</div>
				{/if}
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
										checked={allPageSelected}
										indeterminate={someSelected && !allPageSelected}
										onchange={toggleSelectPage}
										class="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
										title="Seleziona tutti nella pagina"
									/>
								</th>
								<th
									class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none {isSortActive('email') ? 'text-blue-600' : 'text-gray-500'}"
									onclick={() => handleSort('email')}
								>
									Email <span class="ml-1">{getSortIcon('email')}</span>
								</th>
								<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
									CF
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
									<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">
										{user.taxCode || "-"}
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
										{#if !user.membershipStatus && user.profileComplete}
											<span
												class="status-badge bg-blue-100 text-blue-800"
												data-tooltip="L'utente ha completato il profilo e deve effettuare il pagamento"
											>
												In attesa di pagamento
											</span>
										{:else if !user.membershipStatus}
											<span
												class="status-badge bg-gray-100 text-gray-600"
												data-tooltip="L'utente si è registrato ma non ha ancora completato il profilo"
											>
												Profilo incompleto
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
												class="status-badge bg-purple-100 text-purple-800"
												data-tooltip="Il pagamento è stato avviato e siamo in attesa della conferma"
											>
												Pagamento in corso
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

				<!-- Pagination -->
				{#if data.pagination.totalPages > 1}
					<div class="mt-4 flex items-center justify-between border-t border-gray-200 bg-white px-4 py-3 sm:px-6">
						<div class="flex flex-1 justify-between sm:hidden">
							<button
								onclick={() => goToPage(data.pagination.page - 1)}
								disabled={data.pagination.page <= 1}
								class="relative inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
							>
								Precedente
							</button>
							<button
								onclick={() => goToPage(data.pagination.page + 1)}
								disabled={data.pagination.page >= data.pagination.totalPages}
								class="relative ml-3 inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
							>
								Successivo
							</button>
						</div>
						<div class="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
							<div>
								<p class="text-sm text-gray-700">
									Mostrati <span class="font-medium">{(data.pagination.page - 1) * data.pagination.pageSize + 1}</span> - <span class="font-medium">{Math.min(data.pagination.page * data.pagination.pageSize, data.pagination.totalCount)}</span> di <span class="font-medium">{data.pagination.totalCount}</span> utenti
								</p>
							</div>
							<div>
								<nav class="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
									<button
										onclick={() => goToPage(data.pagination.page - 1)}
										disabled={data.pagination.page <= 1}
										class="relative inline-flex items-center rounded-l-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50 disabled:cursor-not-allowed"
									>
										<span class="sr-only">Precedente</span>
										<svg class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
											<path fill-rule="evenodd" d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z" clip-rule="evenodd" />
										</svg>
									</button>
									{#each getPaginationRange(data.pagination.page, data.pagination.totalPages) as pageNum}
										{#if pageNum === '...'}
											<span class="relative inline-flex items-center px-4 py-2 text-sm font-semibold text-gray-700 ring-1 ring-inset ring-gray-300">...</span>
										{:else}
											<button
												onclick={() => goToPage(pageNum as number)}
												class="relative inline-flex items-center px-4 py-2 text-sm font-semibold ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 {data.pagination.page === pageNum ? 'z-10 bg-blue-600 text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600' : 'text-gray-900'}"
											>
												{pageNum}
											</button>
										{/if}
									{/each}
									<button
										onclick={() => goToPage(data.pagination.page + 1)}
										disabled={data.pagination.page >= data.pagination.totalPages}
										class="relative inline-flex items-center rounded-r-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50 disabled:cursor-not-allowed"
									>
										<span class="sr-only">Successivo</span>
										<svg class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
											<path fill-rule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clip-rule="evenodd" />
										</svg>
									</button>
								</nav>
							</div>
						</div>
					</div>
				{/if}
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
