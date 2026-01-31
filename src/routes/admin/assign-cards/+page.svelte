<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageData } from './$types';
	import type { AssignmentResult } from './+page.server';

	// Explicit type for form action data
	type AssignCardsFormData = {
		success?: boolean;
		result?: AssignmentResult;
		assignedUserIds?: string[];
		errors?: {
			_form?: string;
			userIds?: string;
			startNumber?: string;
			endNumber?: string;
			membershipNumber?: string;
			mode?: string;
		};
	} | null;

	let { data, form }: { data: PageData; form: AssignCardsFormData } = $props();

	// Assignment mode
	type AssignmentMode = 'auto' | 'range' | 'single';
	let assignmentMode = $state<AssignmentMode>('auto');

	// Batch assignment state
	let selectedUserIds = $state<string[]>([]);
	let loading = $state(false);
	let exportCompleted = $state(false);
	let exportError = $state(false);

	// Range mode inputs
	let startNumber = $state('');
	let endNumber = $state('');

	// Single mode input
	let membershipNumber = $state('');

	// Reactive: select all checkbox state
	let allSelected = $derived(
		data.usersAwaitingCard.length > 0 &&
		selectedUserIds.length === data.usersAwaitingCard.length
	);

	// Reactive: single mode only enabled when exactly 1 user selected
	let singleModeEnabled = $derived(selectedUserIds.length === 1);

	// Switch to auto mode if single mode selected but more/less than 1 user
	$effect(() => {
		if (assignmentMode === 'single' && !singleModeEnabled) {
			assignmentMode = 'auto';
		}
	});

	// Reactive: range info for warning messages
	let rangeCount = $derived(() => {
		if (assignmentMode !== 'range') return 0;
		const start = parseInt(startNumber, 10);
		const end = parseInt(endNumber, 10);
		if (isNaN(start) || isNaN(end) || start > end) return 0;
		return end - start + 1;
	});

	// Computed validation for submit button
	let canSubmit = $derived(() => {
		if (selectedUserIds.length === 0) return false;

		switch (assignmentMode) {
			case 'auto':
				return data.availableNumbersCount > 0;
			case 'range':
				const start = parseInt(startNumber, 10);
				const end = parseInt(endNumber, 10);
				return !isNaN(start) && !isNaN(end) && start <= end;
			case 'single':
				return membershipNumber.trim().length > 0;
		}
	});

	function formatDate(isoString: string | null): string {
		if (!isoString) return '-';
		return new Date(isoString).toLocaleDateString('it-IT', {
			year: 'numeric',
			month: 'long',
			day: 'numeric'
		});
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

	async function downloadAICSExport(userIds: string[]) {
		try {
			const response = await fetch('/admin/export', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ format: 'aics', userIds })
			});
			if (!response.ok) {
				exportError = true;
				return;
			}
			const blob = await response.blob();
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = `aics-tessere-${new Date().toISOString().slice(0, 10)}.xlsx`;
			a.click();
			URL.revokeObjectURL(url);
			exportCompleted = true;
		} catch {
			exportError = true;
		}
	}
</script>

<div class="space-y-6">
	<!-- Page Header -->
	<div>
		<h1 class="text-2xl font-bold text-gray-900">Assegnazione Tessere</h1>
		<p class="text-sm text-gray-600 mt-1">Assegna automaticamente i numeri tessera agli utenti che hanno completato il pagamento</p>
	</div>

	<!-- Main Content -->
	<div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
		<!-- Available Numbers Info -->
		<div class="mb-6 p-4 rounded-lg {data.availableNumbersCount > 0 ? 'bg-green-50 border border-green-200' : 'bg-yellow-50 border border-yellow-200'}">
			<div class="flex items-center justify-between flex-wrap gap-2 mb-3">
				<div>
					<p class="text-sm font-medium {data.availableNumbersCount > 0 ? 'text-green-800' : 'text-yellow-800'}">
						Numeri tessera disponibili: <strong>{data.availableNumbersCount}</strong>
					</p>
					{#if data.availableNumbersCount === 0}
						<p class="text-xs text-yellow-600 mt-1">
							Configura i range delle tessere per poter assegnare numeri.
						</p>
					{/if}
				</div>
				<a
					href="/admin/card-ranges"
					class="text-sm text-blue-600 hover:text-blue-800 underline"
				>
					Gestisci Range
				</a>
			</div>

			<!-- Configured Ranges Display -->
			{#if data.cardRanges.length > 0}
				<div class="border-t {data.availableNumbersCount > 0 ? 'border-green-200' : 'border-yellow-200'} pt-3 mt-3">
					<p class="text-xs font-medium {data.availableNumbersCount > 0 ? 'text-green-700' : 'text-yellow-700'} mb-2">
						Range configurati e numeri disponibili:
					</p>
					<div class="space-y-2">
						{#each data.cardRanges.filter(r => r.availableNumbers > 0) as range (range.id)}
							<div class="bg-white border border-green-300 rounded-md p-2">
								<div class="flex items-center justify-between">
									<span class="text-xs font-medium text-green-800">
										Range {range.startNumber}–{range.endNumber}
									</span>
									<span class="text-xs text-gray-500">
										{range.availableNumbers}/{range.totalNumbers} disponibili
									</span>
								</div>
								<div class="mt-1.5 flex flex-wrap gap-1">
									{#each range.availableSubRanges as subRange}
										<span class="inline-block px-1.5 py-0.5 rounded text-xs bg-green-100 text-green-700 font-mono">
											{#if subRange.start === subRange.end}
												{subRange.start}
											{:else}
												{subRange.start}–{subRange.end}
											{/if}
										</span>
									{/each}
								</div>
							</div>
						{/each}
					</div>
				</div>
			{:else}
				<div class="border-t border-yellow-200 pt-3 mt-3">
					<p class="text-xs text-yellow-600">
						Nessun range configurato. <a href="/admin/card-ranges" class="underline">Configura i range</a> prima di assegnare tessere.
					</p>
				</div>
			{/if}
		</div>

		<!-- Success Result -->
		{#if form?.success && form?.result}
			<div class="mb-6 rounded-lg border border-green-200 bg-green-50 p-4">
				<h3 class="text-lg font-semibold text-green-800 mb-3">
					{exportCompleted ? 'Assegnazione ed export completato' : 'Assegnazione completata'}
				</h3>

				{#if form.result.mode === 'auto' || form.result.mode === 'range'}
					{@const resultData = form.result.data}
					<ul class="space-y-2 text-sm text-green-700">
						<li>
							<strong>Tessere assegnate:</strong> {resultData.assigned.length}
							{#if resultData.assigned.length > 0}
								<ul class="ml-4 mt-1 text-xs">
									{#each resultData.assigned as a}
										<li>{a.email} → {a.membershipNumber}</li>
									{/each}
								</ul>
							{/if}
						</li>
						{#if resultData.usersWithoutCard.length > 0}
							<li class="text-red-700">
								<strong>Utenti rimasti senza tessera:</strong> {resultData.usersWithoutCard.length}
								<ul class="ml-4 mt-1 text-xs">
									{#each resultData.usersWithoutCard as u}
										<li>{u.email}</li>
									{/each}
								</ul>
							</li>
						{/if}
						{#if form.result.mode === 'range' && 'skipped' in resultData && resultData.skipped.length > 0}
							<li class="text-yellow-700">
								<strong>Numeri saltati (già assegnati):</strong> {resultData.skipped.length}
								<span class="text-xs ml-2">({resultData.skipped.join(', ')})</span>
							</li>
						{/if}
						{#if form.result.mode === 'range' && 'remaining' in resultData && resultData.remaining.length > 0}
							<li class="text-blue-700">
								<strong>Numeri rimanenti:</strong> {resultData.remaining.length}
								<span class="text-xs ml-2">({resultData.remaining.slice(0, 10).join(', ')}{resultData.remaining.length > 10 ? '...' : ''})</span>
							</li>
						{/if}
					</ul>
				{:else if form.result.mode === 'single'}
					{@const resultData = form.result.data}
					<ul class="space-y-2 text-sm text-green-700">
						<li>
							<strong>Tessera assegnata:</strong>
							<span class="ml-2">{resultData.email} → {resultData.membershipNumber}</span>
						</li>
					</ul>
				{/if}

				{#if form?.assignedUserIds?.length}
					<div class="mt-3 pt-3 border-t border-green-200">
						{#if exportError}
							<p class="text-sm text-red-700 mb-2">Errore durante il download del file AICS. Riprova:</p>
						{/if}
						<button
							type="button"
							onclick={() => { exportError = false; downloadAICSExport(form?.assignedUserIds ?? []); }}
							class="inline-flex items-center gap-1.5 text-sm font-medium text-green-700 hover:text-green-900 underline"
						>
							<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
							</svg>
							Scarica file AICS
						</button>
					</div>
				{/if}
			</div>
		{/if}

		<!-- Error Message -->
		{#if form?.errors?._form}
			<div class="mb-6 rounded-lg border border-red-200 bg-red-50 p-4">
				<p class="text-sm text-red-700">{form.errors._form}</p>
			</div>
		{/if}

		{#if data.usersAwaitingCard.length === 0}
			<div class="text-center py-12 text-gray-500">
				<svg class="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
				</svg>
				<p class="text-lg">Nessun utente in attesa di assegnazione tessera.</p>
				<p class="text-sm mt-1">Gli utenti appariranno qui dopo aver completato il pagamento.</p>
			</div>
		{:else}
			<form
				method="POST"
				action="?/assignCards"
				use:enhance={() => {
					loading = true;
					exportCompleted = false;
					exportError = false;
					return async ({ result, update }) => {
						await update({ invalidateAll: true, reset: false });
						loading = false;
						selectedUserIds = [];
						window.scrollTo({ top: 0, behavior: 'smooth' });
						if (result.type === 'success') {
							const data = result.data as Record<string, unknown> | undefined;
							const userIds = data?.assignedUserIds as string[] | undefined;
							if (userIds && userIds.length > 0) {
								downloadAICSExport(userIds);
							}
						}
					};
				}}
			>
				{#if form?.errors?.userIds}
					<p class="text-sm text-red-600 mb-4">{form.errors.userIds}</p>
				{/if}
				{#if form?.errors?.mode}
					<p class="text-sm text-red-600 mb-4">{form.errors.mode}</p>
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
								<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden sm:table-cell">
									Nome
								</th>
								<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden sm:table-cell">
									Cognome
								</th>
								<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">
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
										<div>{user.email}</div>
										<div class="sm:hidden text-xs text-gray-500">{user.firstName} {user.lastName}</div>
									</td>
									<td class="px-4 py-3 whitespace-nowrap text-sm text-gray-900 hidden sm:table-cell">
										{user.firstName}
									</td>
									<td class="px-4 py-3 whitespace-nowrap text-sm text-gray-900 hidden sm:table-cell">
										{user.lastName}
									</td>
									<td class="px-4 py-3 whitespace-nowrap text-sm text-gray-500 hidden md:table-cell">
										{formatDate(user.paymentDate)}
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>

				<!-- Assignment Mode Selection -->
				<div class="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
					<h3 class="text-sm font-medium text-gray-700 mb-3">Modalità di assegnazione</h3>

					<input type="hidden" name="mode" value={assignmentMode} />

					<div class="space-y-3">
						<!-- Auto Mode -->
						<label class="flex items-start gap-3 cursor-pointer">
							<input
								type="radio"
								name="assignmentModeRadio"
								value="auto"
								checked={assignmentMode === 'auto'}
								onchange={() => assignmentMode = 'auto'}
								class="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
							/>
							<div>
								<span class="text-sm font-medium text-gray-900">Automatica (dal pool)</span>
								<p class="text-xs text-gray-500">Assegna i prossimi numeri disponibili dai range configurati</p>
							</div>
						</label>

						<!-- Range Mode -->
						<label class="flex items-start gap-3 cursor-pointer">
							<input
								type="radio"
								name="assignmentModeRadio"
								value="range"
								checked={assignmentMode === 'range'}
								onchange={() => assignmentMode = 'range'}
								class="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
							/>
							<div class="flex-1">
								<span class="text-sm font-medium text-gray-900">Range specifico</span>
								<p class="text-xs text-gray-500">Assegna numeri da un valore iniziale a uno finale</p>
								{#if assignmentMode === 'range'}
									<div class="mt-2 flex items-center gap-2">
										<input
											type="text"
											name="startNumber"
											placeholder="Da"
											bind:value={startNumber}
											class="w-24 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
										/>
										<span class="text-gray-500">a</span>
										<input
											type="text"
											name="endNumber"
											placeholder="A"
											bind:value={endNumber}
											class="w-24 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
										/>
									</div>
									{#if form?.errors?.startNumber}
										<p class="text-xs text-red-600 mt-1">{form.errors.startNumber}</p>
									{/if}
									{#if form?.errors?.endNumber}
										<p class="text-xs text-red-600 mt-1">{form.errors.endNumber}</p>
									{/if}
									{#if rangeCount() > 0 && rangeCount() > selectedUserIds.length}
										<p class="text-xs text-yellow-600 mt-1">
											{rangeCount() - selectedUserIds.length} numeri avanzeranno (range: {rangeCount()}, utenti: {selectedUserIds.length})
										</p>
									{/if}
									{#if rangeCount() > 0 && rangeCount() < selectedUserIds.length}
										<p class="text-xs text-red-600 mt-1">
											{selectedUserIds.length - rangeCount()} utenti rimarranno senza tessera (range: {rangeCount()}, utenti: {selectedUserIds.length})
										</p>
									{/if}
								{/if}
							</div>
						</label>

						<!-- Single Mode -->
						<label class="flex items-start gap-3 {singleModeEnabled ? 'cursor-pointer' : 'opacity-50 cursor-not-allowed'}">
							<input
								type="radio"
								name="assignmentModeRadio"
								value="single"
								checked={assignmentMode === 'single'}
								onchange={() => assignmentMode = 'single'}
								disabled={!singleModeEnabled}
								class="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 disabled:opacity-50"
							/>
							<div class="flex-1">
								<span class="text-sm font-medium text-gray-900">Numero singolo</span>
								<p class="text-xs text-gray-500">
									{#if singleModeEnabled}
										Assegna un numero specifico all'utente selezionato
									{:else}
										Seleziona esattamente 1 utente per abilitare questa opzione
									{/if}
								</p>
								{#if assignmentMode === 'single'}
									<div class="mt-2">
										<input
											type="text"
											name="membershipNumber"
											placeholder="Numero tessera"
											bind:value={membershipNumber}
											class="w-40 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
										/>
									</div>
									{#if form?.errors?.membershipNumber}
										<p class="text-xs text-red-600 mt-1">{form.errors.membershipNumber}</p>
									{/if}
								{/if}
							</div>
						</label>
					</div>
				</div>

				<!-- Selection Count and Submit -->
				<div class="flex items-center justify-between flex-wrap gap-4">
					<p class="text-sm text-gray-600">
						{selectedUserIds.length} utenti selezionati
						{#if assignmentMode === 'auto' && selectedUserIds.length > data.availableNumbersCount}
							<span class="text-red-600 ml-2">
								(solo {data.availableNumbersCount} numeri disponibili nel pool!)
							</span>
						{/if}
					</p>
					<button
						type="submit"
						disabled={loading || !canSubmit()}
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
</div>
