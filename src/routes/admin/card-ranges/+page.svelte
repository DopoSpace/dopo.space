<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageData } from './$types';

	type FormData = {
		success?: boolean;
		deleted?: boolean;
		errors?: {
			_form?: string;
			startNumber?: string;
			endNumber?: string;
		};
		conflicts?: string[];
		values?: {
			startNumber?: string;
			endNumber?: string;
		};
	} | null;

	let { data, form }: { data: PageData; form: FormData } = $props();

	let loading = $state(false);
	let showAssignedNumbers = $state(false);

	// Preview calculation
	let previewStart = $state('');
	let previewEnd = $state('');

	let previewNumbers = $derived(() => {
		const start = parseInt(previewStart, 10);
		const end = parseInt(previewEnd, 10);

		if (isNaN(start) || isNaN(end) || start > end) return [];
		if (end - start + 1 > 20) {
			// Show first 5 and last 5
			const first = [];
			const last = [];
			for (let i = start; i < start + 5; i++) {
				first.push(i.toString());
			}
			for (let i = end - 4; i <= end; i++) {
				last.push(i.toString());
			}
			return [...first, '...', ...last];
		}

		const numbers = [];
		for (let i = start; i <= end; i++) {
			numbers.push(i.toString());
		}
		return numbers;
	});

	let totalInPreview = $derived(() => {
		const start = parseInt(previewStart, 10);
		const end = parseInt(previewEnd, 10);
		if (isNaN(start) || isNaN(end) || start > end) return 0;
		return end - start + 1;
	});

	// Calculate totals
	let totalAvailable = $derived(
		data.ranges.reduce((sum, r) => sum + r.availableNumbers, 0)
	);

	let totalUsed = $derived(
		data.ranges.reduce((sum, r) => sum + r.usedNumbers, 0)
	);

	function formatDate(isoString: string): string {
		return new Date(isoString).toLocaleDateString('it-IT', {
			year: 'numeric',
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	function formatRange(start: number, end: number): string {
		return `${start} - ${end}`;
	}
</script>

<div class="space-y-6">
	<!-- Page Header -->
	<div>
		<h1 class="text-2xl font-bold text-gray-900">Range Tessere</h1>
		<p class="text-sm text-gray-600 mt-1">Configura i range di numeri disponibili per le tessere</p>
	</div>

	<!-- Main Content -->
		{#if !data.activeYear}
			<div class="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
				<p class="text-yellow-800 font-medium">Nessun anno associativo attivo.</p>
				<p class="text-yellow-600 text-sm mt-1">Configura un anno associativo per gestire i range delle tessere.</p>
			</div>
		{:else}
			<!-- Year Info -->
			<div class="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
				<p class="text-blue-800">
					<strong>Anno associativo attivo:</strong>
					{new Date(data.activeYear.startDate).getFullYear()} -
					{new Date(data.activeYear.endDate).getFullYear()}
				</p>
			</div>

			<!-- Stats Summary -->
			<div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
				<div class="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
					<p class="text-sm text-gray-600">Range configurati</p>
					<p class="text-2xl font-bold text-gray-900">{data.ranges.length}</p>
				</div>
				<div class="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
					<p class="text-sm text-gray-600">Numeri disponibili</p>
					<p class="text-2xl font-bold text-green-600">{totalAvailable}</p>
				</div>
				<div class="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
					<p class="text-sm text-gray-600">Numeri assegnati</p>
					<p class="text-2xl font-bold text-blue-600">{totalUsed}</p>
				</div>
			</div>

			<!-- Add Range Form -->
			<div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
				<h2 class="text-xl font-bold text-gray-900 mb-4">Aggiungi Nuovo Range</h2>

				{#if form?.success && !form?.deleted}
					<div class="mb-4 rounded-lg border border-green-200 bg-green-50 p-4">
						<p class="text-sm text-green-700">Range aggiunto con successo!</p>
					</div>
				{/if}

				{#if form?.deleted}
					<div class="mb-4 rounded-lg border border-green-200 bg-green-50 p-4">
						<p class="text-sm text-green-700">Range eliminato con successo!</p>
					</div>
				{/if}

				{#if form?.errors?._form}
					<div class="mb-4 rounded-lg border border-red-200 bg-red-50 p-4">
						<p class="text-sm text-red-700">{form.errors._form}</p>
						{#if form.conflicts && form.conflicts.length > 0}
							<p class="text-xs text-red-600 mt-2">
								Numeri in conflitto: {form.conflicts.slice(0, 10).join(', ')}
								{#if form.conflicts.length > 10}
									e altri {form.conflicts.length - 10}
								{/if}
							</p>
						{/if}
					</div>
				{/if}

				<form
					method="POST"
					action="?/addRange"
					use:enhance={() => {
						loading = true;
						return async ({ update }) => {
							await update({ invalidateAll: true, reset: true });
							loading = false;
							previewStart = '';
							previewEnd = '';
						};
					}}
				>
					<div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
						<div>
							<label for="startNumber" class="label">Numero Inizio</label>
							<input
								type="number"
								id="startNumber"
								name="startNumber"
								bind:value={previewStart}
								placeholder="1"
								min="1"
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
								type="number"
								id="endNumber"
								name="endNumber"
								bind:value={previewEnd}
								placeholder="100"
								min="1"
								required
								class="input text-gray-900"
							/>
							{#if form?.errors?.endNumber}
								<p class="text-sm text-red-600 mt-1">{form.errors.endNumber}</p>
							{/if}
						</div>
					</div>

					<!-- Preview -->
					{#if previewNumbers().length > 0}
						<div class="mb-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
							<p class="text-sm text-gray-600 mb-2">
								Anteprima ({totalInPreview()} numeri):
							</p>
							<div class="flex flex-wrap gap-2">
								{#each previewNumbers() as num}
									{#if num === '...'}
										<span class="text-gray-400">...</span>
									{:else}
										<span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-200 text-gray-700">
											{num}
										</span>
									{/if}
								{/each}
							</div>
						</div>
					{/if}

					<button
						type="submit"
						disabled={loading || !previewStart || !previewEnd}
						class="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
					>
						{#if loading}
							<svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white inline" fill="none" viewBox="0 0 24 24">
								<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
								<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
							</svg>
							Aggiunta in corso...
						{:else}
							Aggiungi Range
						{/if}
					</button>
				</form>
			</div>

			<!-- Existing Ranges -->
			<div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
				<h2 class="text-xl font-bold text-gray-900 mb-4">Range Configurati</h2>

				{#if data.ranges.length === 0}
					<div class="text-center py-8 text-gray-500">
						<p>Nessun range configurato.</p>
						<p class="text-sm mt-1">Aggiungi un range per iniziare ad assegnare tessere.</p>
					</div>
				{:else}
					<div class="overflow-x-auto">
						<table class="min-w-full divide-y divide-gray-200">
							<thead class="bg-gray-50">
								<tr>
									<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
										Range
									</th>
									<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
										Disponibili
									</th>
									<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
										Usati
									</th>
									<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
										Progresso
									</th>
									<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
										Creato
									</th>
									<th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
										Azioni
									</th>
								</tr>
							</thead>
							<tbody class="bg-white divide-y divide-gray-200">
								{#each data.ranges as range (range.id)}
									<tr class="hover:bg-gray-50">
										<td class="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
											{formatRange(range.startNumber, range.endNumber)}
										</td>
										<td class="px-4 py-3 whitespace-nowrap text-sm text-green-600 font-medium">
											{range.availableNumbers}
										</td>
										<td class="px-4 py-3 whitespace-nowrap text-sm text-blue-600">
											{range.usedNumbers}
										</td>
										<td class="px-4 py-3 whitespace-nowrap">
											<div class="w-32 bg-gray-200 rounded-full h-2">
												<div
													class="bg-blue-600 h-2 rounded-full"
													style="width: {(range.usedNumbers / range.totalNumbers) * 100}%"
												></div>
											</div>
											<span class="text-xs text-gray-500">
												{range.usedNumbers}/{range.totalNumbers}
											</span>
										</td>
										<td class="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
											{formatDate(range.createdAt)}
										</td>
										<td class="px-4 py-3 whitespace-nowrap text-right text-sm">
											{#if range.usedNumbers === 0}
												<form
													method="POST"
													action="?/deleteRange"
													class="inline"
													use:enhance={() => {
														if (!confirm('Sei sicuro di voler eliminare questo range?')) {
															return async () => {};
														}
														return async ({ update }) => {
															await update({ invalidateAll: true });
														};
													}}
												>
													<input type="hidden" name="rangeId" value={range.id} />
													<button
														type="submit"
														class="text-red-600 hover:text-red-900"
													>
														Elimina
													</button>
												</form>
											{:else}
												<span class="text-gray-400 text-xs">In uso</span>
											{/if}
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				{/if}
			</div>

			<!-- Assigned Numbers Section -->
			<div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
				<button
					type="button"
					class="flex items-center justify-between w-full text-left"
					onclick={() => (showAssignedNumbers = !showAssignedNumbers)}
				>
					<h2 class="text-xl font-bold text-gray-900">
						Numeri Assegnati
						<span class="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
							{data.assignedNumbers.length}
						</span>
					</h2>
					<svg
						class="h-5 w-5 text-gray-500 transition-transform {showAssignedNumbers ? 'rotate-180' : ''}"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
					>
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
					</svg>
				</button>

				{#if showAssignedNumbers}
					<div class="mt-4">
						{#if data.assignedNumbers.length === 0}
							<div class="text-center py-8 text-gray-500">
								<p>Nessun numero ancora assegnato.</p>
							</div>
						{:else}
							<div class="overflow-x-auto">
								<table class="min-w-full divide-y divide-gray-200">
									<thead class="bg-gray-50">
										<tr>
											<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
												N. Tessera
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
										</tr>
									</thead>
									<tbody class="bg-white divide-y divide-gray-200">
										{#each data.assignedNumbers as assigned}
											<tr class="hover:bg-gray-50">
												<td class="px-4 py-3 whitespace-nowrap">
													<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
														{assigned.membershipNumber}
													</span>
												</td>
												<td class="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
													{assigned.email}
												</td>
												<td class="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
													{assigned.firstName}
												</td>
												<td class="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
													{assigned.lastName}
												</td>
											</tr>
										{/each}
									</tbody>
								</table>
							</div>
						{/if}
					</div>
				{/if}
			</div>
		{/if}
</div>
