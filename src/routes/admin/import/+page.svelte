<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageData, ActionData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	// UI State
	type ViewState = 'upload' | 'preview' | 'importing' | 'result';
	let viewState = $state<ViewState>('upload');

	// File state
	let selectedFile = $state<File | null>(null);
	let isDragging = $state(false);
	let uploadError = $state<string | null>(null);
	let isUploading = $state(false);

	// Preview state
	let previewId = $state<string | null>(null);
	let previewData = $state<{
		totalRows: number;
		uniqueRowCount: number;
		validCount: number;
		warningCount: number;
		errorCount: number;
		duplicateCount: number;
		mergedGroups: Array<{
			email: string;
			rows: number[];
			conflicts: Array<{
				field: string;
				usedValue: string;
				usedFromRow: number;
				discardedValue: string;
				discardedFromRow: number;
			}>;
		}>;
		rows: Array<{
			rowNumber: number;
			original: {
				cognome: string;
				nome: string;
				email: string;
				dataNascita: string;
				codiceFiscale: string;
				provinciaNascita: string;
				numeroTessera: string;
			};
			status: 'valid' | 'warning' | 'error';
			errors: string[];
			warnings: string[];
			isExistingUser?: boolean;
		}>;
	} | null>(null);

	// Filter state
	let statusFilter = $state<'all' | 'valid' | 'warning' | 'error'>('all');

	// Import options
	let addMembershipToExisting = $state(false);

	// Import state
	let isImporting = $state(false);
	let importResult = $state<{
		totalRows: number;
		importedCount: number;
		skippedCount: number;
		errorCount: number;
		errors: Array<{ rowNumber: number; email: string; errors: string[] }>;
		warnings: Array<{ rowNumber: number; email: string; warnings: string[] }>;
		newsletter: {
			requested: number;
			subscribed: number;
			alreadySubscribed: number;
			failed: number;
			errors: Array<{ email: string; error: string }>;
		};
	} | null>(null);
	let resultId = $state<string | null>(null);

	// Download state
	let isDownloading = $state(false);

	// Filtered rows
	let filteredRows = $derived(() => {
		if (!previewData) return [];
		if (statusFilter === 'all') return previewData.rows;
		return previewData.rows.filter(r => r.status === statusFilter);
	});

	// Handle form response
	$effect(() => {
		if (form) {
			if ('error' in form && form.error) {
				uploadError = form.error;
				isUploading = false;
				isImporting = false;
			} else if ('success' in form && form.success) {
				if ('previewId' in form && form.previewId) {
					// Upload success
					previewId = form.previewId;
					previewData = form.preview as typeof previewData;
					// Restore the addMembershipToExisting option from server response
					if ('addMembershipToExisting' in form) {
						addMembershipToExisting = form.addMembershipToExisting as boolean;
					}
					viewState = 'preview';
					isUploading = false;
				} else if ('resultId' in form && form.resultId) {
					// Import success
					resultId = form.resultId;
					importResult = form.result as typeof importResult;
					viewState = 'result';
					isImporting = false;
				} else if ('report' in form && form.report) {
					// Download report
					downloadBase64File(form.report as string, form.filename as string);
					isDownloading = false;
				}
			}
		}
	});

	function handleDragOver(e: DragEvent) {
		e.preventDefault();
		isDragging = true;
	}

	function handleDragLeave(e: DragEvent) {
		e.preventDefault();
		isDragging = false;
	}

	function handleDrop(e: DragEvent) {
		e.preventDefault();
		isDragging = false;

		const files = e.dataTransfer?.files;
		if (files && files.length > 0) {
			handleFileSelect(files[0]);
		}
	}

	function handleFileInput(e: Event) {
		const input = e.target as HTMLInputElement;
		if (input.files && input.files.length > 0) {
			handleFileSelect(input.files[0]);
		}
	}

	function handleFileSelect(file: File) {
		uploadError = null;

		// Validate file type
		const validTypes = [
			'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
			'application/vnd.ms-excel',
			'text/csv'
		];
		const validExtensions = ['.xlsx', '.xls', '.csv'];
		const hasValidExtension = validExtensions.some(ext =>
			file.name.toLowerCase().endsWith(ext)
		);

		if (!validTypes.includes(file.type) && !hasValidExtension) {
			uploadError = 'Formato file non supportato. Usa .xlsx o .csv';
			return;
		}

		// Validate file size (5MB)
		if (file.size > 5 * 1024 * 1024) {
			uploadError = 'Il file è troppo grande (max 5MB)';
			return;
		}

		selectedFile = file;
	}

	function resetUpload() {
		selectedFile = null;
		previewId = null;
		previewData = null;
		importResult = null;
		resultId = null;
		uploadError = null;
		viewState = 'upload';
		statusFilter = 'all';
		addMembershipToExisting = false;
	}

	function downloadBase64File(base64: string, filename: string) {
		const byteCharacters = atob(base64);
		const byteNumbers = new Array(byteCharacters.length);
		for (let i = 0; i < byteCharacters.length; i++) {
			byteNumbers[i] = byteCharacters.charCodeAt(i);
		}
		const byteArray = new Uint8Array(byteNumbers);
		const blob = new Blob([byteArray], {
			type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
		});
		const url = URL.createObjectURL(blob);
		const link = document.createElement('a');
		link.href = url;
		link.download = filename;
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
		URL.revokeObjectURL(url);
	}

	function getStatusBadgeClass(status: 'valid' | 'warning' | 'error'): string {
		switch (status) {
			case 'valid':
				return 'bg-green-100 text-green-800';
			case 'warning':
				return 'bg-yellow-100 text-yellow-800';
			case 'error':
				return 'bg-red-100 text-red-800';
		}
	}

	function getStatusIcon(status: 'valid' | 'warning' | 'error'): string {
		switch (status) {
			case 'valid':
				return '✓';
			case 'warning':
				return '⚠';
			case 'error':
				return '✕';
		}
	}
</script>

<div class="space-y-6">
	<!-- Page Header -->
	<div>
		<h1 class="text-2xl font-bold text-gray-900">Import Utenti</h1>
		<p class="text-sm text-gray-600 mt-1">Importa utenti da file Excel o CSV (formato AICS)</p>
	</div>

	<!-- Main Content Card -->
	<div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
		{#if viewState === 'upload'}
			<!-- Upload State -->
			<div class="space-y-6">
				<div class="flex items-center gap-2 text-sm text-gray-500">
					<span class="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-medium">1</span>
					<span class="font-medium text-gray-700">Carica il file</span>
				</div>

				<!-- Error message -->
				{#if uploadError}
					<div class="p-4 bg-red-50 border border-red-200 rounded-lg">
						<p class="text-sm text-red-800">{uploadError}</p>
					</div>
				{/if}

				<!-- Drag & Drop Zone -->
				<div
					class="border-2 border-dashed rounded-lg p-12 text-center transition-colors {isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'}"
					ondragover={handleDragOver}
					ondragleave={handleDragLeave}
					ondrop={handleDrop}
					role="button"
					tabindex="0"
				>
					{#if selectedFile}
						<div class="space-y-4">
							<div class="flex items-center justify-center gap-2">
								<svg class="h-8 w-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
								</svg>
								<span class="text-lg font-medium text-gray-700">{selectedFile.name}</span>
							</div>
							<p class="text-sm text-gray-500">
								{(selectedFile.size / 1024).toFixed(1)} KB
							</p>

							<!-- Import option for existing users -->
							<label class="flex items-start gap-3 cursor-pointer text-left max-w-md mx-auto p-3 bg-amber-50 border border-amber-200 rounded-lg">
								<input
									type="checkbox"
									bind:checked={addMembershipToExisting}
									class="mt-1 h-4 w-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500"
								/>
								<div>
									<span class="text-sm font-medium text-amber-800">Aggiungi membership a utenti esistenti</span>
									<p class="text-xs text-amber-700 mt-0.5">
										Se attivo, gli utenti già presenti nel sistema non saranno considerati errori.
										Verrà aggiunta solo la membership (se non già attiva).
									</p>
								</div>
							</label>

							<div class="flex justify-center gap-3">
								<button
									type="button"
									onclick={resetUpload}
									class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
								>
									Cambia file
								</button>
								<form
									method="POST"
									action="?/upload"
									enctype="multipart/form-data"
									use:enhance={() => {
										isUploading = true;
										uploadError = null;
										return async ({ update }) => {
											await update();
										};
									}}
								>
									<input type="file" name="file" class="hidden" id="hiddenFileInput" />
									<input type="hidden" name="addMembershipToExisting" value={addMembershipToExisting.toString()} />
									<button
										type="submit"
										disabled={isUploading}
										class="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
										onclick={(e) => {
											// Set the file in the hidden input before submit
											const input = document.getElementById('hiddenFileInput') as HTMLInputElement;
											const dataTransfer = new DataTransfer();
											if (selectedFile) {
												dataTransfer.items.add(selectedFile);
												input.files = dataTransfer.files;
											}
										}}
									>
										{#if isUploading}
											<svg class="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
												<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
												<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
											</svg>
											Analisi in corso...
										{:else}
											Analizza file
										{/if}
									</button>
								</form>
							</div>
						</div>
					{:else}
						<div class="space-y-4">
							<svg class="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
							</svg>
							<div>
								<p class="text-lg text-gray-700">Trascina qui il file o</p>
								<label class="mt-2 inline-block cursor-pointer">
									<span class="text-blue-600 hover:text-blue-700 font-medium">seleziona dal computer</span>
									<input
										type="file"
										accept=".xlsx,.xls,.csv"
										class="hidden"
										onchange={handleFileInput}
									/>
								</label>
							</div>
							<p class="text-sm text-gray-500">
								Formati supportati: .xlsx, .csv - Max 5MB
							</p>
						</div>
					{/if}
				</div>

				<!-- Info box -->
				<div class="p-4 bg-blue-50 border border-blue-200 rounded-lg">
					<h3 class="text-sm font-medium text-blue-800 mb-2">Formato file supportato</h3>
					<ul class="text-sm text-blue-700 space-y-1">
						<li>• File Excel (.xlsx) o CSV</li>
						<li>• Colonne richieste: Cognome, Nome, E-mail, Data di nascita</li>
						<li>• Colonne opzionali: Codice fiscale, Indirizzo, Comune, CAP, Provincia, Sesso</li>
						<li>• Tessera: N° tessera, Data rilascio (per import con membership)</li>
					</ul>
				</div>
			</div>

		{:else if viewState === 'preview' && previewData}
			<!-- Preview State -->
			<div class="space-y-6">
				<div class="flex items-center gap-2 text-sm text-gray-500">
					<span class="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-medium">2</span>
					<span class="font-medium text-gray-700">Verifica e importa</span>
				</div>

				<!-- Summary -->
				{#if previewData.totalRows !== previewData.uniqueRowCount}
					<div class="p-3 bg-blue-50 border border-blue-200 rounded-lg mb-4">
						<p class="text-sm text-blue-800">
							<strong>{previewData.totalRows}</strong> righe nel file → <strong>{previewData.uniqueRowCount}</strong> utenti unici
							<span class="text-blue-600">({previewData.totalRows - previewData.uniqueRowCount} righe duplicate unite per email)</span>
						</p>
						{#if previewData.mergedGroups && previewData.mergedGroups.length > 0}
							<details class="mt-2">
								<summary class="text-sm text-blue-700 cursor-pointer hover:text-blue-900">
									Mostra {previewData.mergedGroups.length} gruppi di righe unite
								</summary>
								<div class="mt-2 max-h-48 overflow-auto bg-white rounded border border-blue-200 p-2">
									<ul class="text-xs space-y-1">
										{#each previewData.mergedGroups as group}
											<li class="py-1 border-b border-gray-100 last:border-0">
												<span class="font-medium text-gray-700">{group.email}</span>
												<span class="text-gray-500"> — righe {group.rows.join(', ')}</span>
												{#if group.conflicts.length > 0}
													<span class="text-amber-600 ml-1">
														({group.conflicts.length} conflitt{group.conflicts.length === 1 ? 'o' : 'i'})
													</span>
												{/if}
											</li>
										{/each}
									</ul>
								</div>
							</details>
						{/if}
					</div>
				{/if}
				<div class="grid grid-cols-2 md:grid-cols-4 gap-4">
					<div class="p-4 bg-gray-50 rounded-lg text-center">
						<p class="text-2xl font-bold text-gray-900">{previewData.uniqueRowCount}</p>
						<p class="text-sm text-gray-500">Utenti unici</p>
					</div>
					<button
						type="button"
						onclick={() => statusFilter = statusFilter === 'valid' ? 'all' : 'valid'}
						class="p-4 rounded-lg text-center transition-colors {statusFilter === 'valid' ? 'bg-green-200 ring-2 ring-green-500' : 'bg-green-50 hover:bg-green-100'}"
					>
						<p class="text-2xl font-bold text-green-700">{previewData.validCount}</p>
						<p class="text-sm text-green-600">Importabili</p>
					</button>
					<button
						type="button"
						onclick={() => statusFilter = statusFilter === 'warning' ? 'all' : 'warning'}
						class="p-4 rounded-lg text-center transition-colors {statusFilter === 'warning' ? 'bg-yellow-200 ring-2 ring-yellow-500' : 'bg-yellow-50 hover:bg-yellow-100'}"
					>
						<p class="text-2xl font-bold text-yellow-700">{previewData.warningCount}</p>
						<p class="text-sm text-yellow-600">Con avvisi</p>
					</button>
					<button
						type="button"
						onclick={() => statusFilter = statusFilter === 'error' ? 'all' : 'error'}
						class="p-4 rounded-lg text-center transition-colors {statusFilter === 'error' ? 'bg-red-200 ring-2 ring-red-500' : 'bg-red-50 hover:bg-red-100'}"
					>
						<p class="text-2xl font-bold text-red-700">{previewData.errorCount}</p>
						<p class="text-sm text-red-600">Errori</p>
					</button>
				</div>

				<!-- Import Options -->
				{#if addMembershipToExisting}
					<div class="p-3 bg-amber-50 border border-amber-200 rounded-lg">
						<p class="text-sm text-amber-800">
							<strong>Modalità "Aggiungi membership":</strong> Gli utenti già esistenti nel sistema non vengono considerati errori.
							Per questi utenti verrà aggiunta solo la membership (se non già attiva).
						</p>
					</div>
				{/if}

				<!-- Preview Table -->
				<div class="border border-gray-200 rounded-lg overflow-hidden">
					<div class="max-h-96 overflow-auto">
						<table class="min-w-full divide-y divide-gray-200">
							<thead class="bg-gray-50 sticky top-0">
								<tr>
									<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">#</th>
									<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cognome</th>
									<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nome</th>
									<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
									<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Data nascita</th>
									<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Stato</th>
									<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Note</th>
								</tr>
							</thead>
							<tbody class="bg-white divide-y divide-gray-200">
								{#each filteredRows() as row (row.rowNumber)}
									<tr class="hover:bg-gray-50">
										<td class="px-4 py-3 text-sm text-gray-500">{row.rowNumber}</td>
										<td class="px-4 py-3 text-sm text-gray-900">{row.original.cognome}</td>
										<td class="px-4 py-3 text-sm text-gray-900">{row.original.nome}</td>
										<td class="px-4 py-3 text-sm text-gray-900">
											{row.original.email}
											{#if row.isExistingUser}
												<span class="ml-1 inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-700" title="Utente già esistente nel sistema">
													esistente
												</span>
											{/if}
										</td>
										<td class="px-4 py-3 text-sm text-gray-900">{row.original.dataNascita}</td>
										<td class="px-4 py-3">
											<span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium {getStatusBadgeClass(row.status)}">
												{getStatusIcon(row.status)}
											</span>
										</td>
										<td class="px-4 py-3 text-sm text-gray-500 max-w-xs truncate" title={[...row.errors, ...row.warnings].join(', ')}>
											{#if row.errors.length > 0}
												<span class="text-red-600">{row.errors[0]}</span>
											{:else if row.warnings.length > 0}
												<span class="text-yellow-600">{row.warnings[0]}</span>
											{:else}
												-
											{/if}
										</td>
									</tr>
								{:else}
									<tr>
										<td colspan="7" class="px-4 py-8 text-center text-sm text-gray-500">
											Nessuna riga corrisponde al filtro selezionato
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				</div>

				<!-- Actions -->
				<div class="flex items-center justify-between pt-4 border-t border-gray-200">
					<div class="flex gap-2">
						<button
							type="button"
							onclick={resetUpload}
							class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
						>
							Annulla
						</button>

						{#if previewData.errorCount > 0}
							<form
								method="POST"
								action="?/downloadErrors"
								use:enhance={() => {
									isDownloading = true;
									return async ({ update }) => {
										await update();
									};
								}}
							>
								<input type="hidden" name="previewId" value={previewId} />
								<button
									type="submit"
									disabled={isDownloading}
									class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
								>
									Scarica report errori
								</button>
							</form>
						{/if}
					</div>

					<form
						method="POST"
						action="?/import"
						use:enhance={() => {
							isImporting = true;
							viewState = 'importing';
							return async ({ update }) => {
								await update();
							};
						}}
					>
						<input type="hidden" name="previewId" value={previewId} />
						<input type="hidden" name="createMembership" value="false" />
						<input type="hidden" name="addMembershipToExisting" value={addMembershipToExisting.toString()} />
						<button
							type="submit"
							disabled={previewData.validCount + previewData.warningCount === 0 || isImporting}
							class="px-6 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
						>
							Importa {previewData.validCount + previewData.warningCount} utenti
						</button>
					</form>
				</div>
			</div>

		{:else if viewState === 'importing'}
			<!-- Importing State -->
			<div class="py-12 text-center">
				<svg class="animate-spin h-12 w-12 mx-auto text-blue-600 mb-4" fill="none" viewBox="0 0 24 24">
					<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
					<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
				</svg>
				<h2 class="text-lg font-medium text-gray-900">Importazione in corso...</h2>
				<p class="text-sm text-gray-500 mt-2">Non chiudere questa pagina</p>
			</div>

		{:else if viewState === 'result' && importResult}
			<!-- Result State -->
			<div class="space-y-6">
				<div class="text-center py-8">
					{#if importResult.errorCount === 0}
						<svg class="h-16 w-16 mx-auto text-green-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
						</svg>
						<h2 class="text-xl font-bold text-gray-900">Import completato!</h2>
					{:else}
						<svg class="h-16 w-16 mx-auto text-yellow-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
						</svg>
						<h2 class="text-xl font-bold text-gray-900">Import completato con errori</h2>
					{/if}
				</div>

				<!-- Summary -->
				<div class="grid grid-cols-3 gap-4">
					<div class="p-4 bg-green-50 rounded-lg text-center">
						<p class="text-2xl font-bold text-green-700">{importResult.importedCount}</p>
						<p class="text-sm font-medium text-green-600">Importati</p>
						<p class="text-xs text-green-500 mt-1">Nuovi utenti creati</p>
					</div>
					<div class="p-4 bg-amber-50 rounded-lg text-center">
						<p class="text-2xl font-bold text-amber-700">{importResult.skippedCount}</p>
						<p class="text-sm font-medium text-amber-600">Saltati</p>
						<p class="text-xs text-amber-500 mt-1">Utenti già esistenti</p>
					</div>
					<div class="p-4 bg-red-50 rounded-lg text-center">
						<p class="text-2xl font-bold text-red-700">{importResult.errorCount}</p>
						<p class="text-sm font-medium text-red-600">Errori</p>
						<p class="text-xs text-red-500 mt-1">Dati non validi</p>
					</div>
				</div>

				<!-- Newsletter Summary -->
				{#if importResult.newsletter && importResult.newsletter.requested > 0}
					<div class="p-4 bg-purple-50 border border-purple-200 rounded-lg">
						<h3 class="text-sm font-medium text-purple-800 mb-3 flex items-center gap-2">
							<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
							</svg>
							Riepilogo Newsletter (Mailchimp)
						</h3>
						<div class="grid grid-cols-4 gap-3">
							<div class="text-center p-2 bg-white rounded">
								<p class="text-lg font-bold text-purple-700">{importResult.newsletter.requested}</p>
								<p class="text-xs text-purple-600">Richieste</p>
							</div>
							<div class="text-center p-2 bg-white rounded">
								<p class="text-lg font-bold text-green-700">{importResult.newsletter.subscribed}</p>
								<p class="text-xs text-green-600">Iscritti</p>
							</div>
							<div class="text-center p-2 bg-white rounded">
								<p class="text-lg font-bold text-blue-700">{importResult.newsletter.alreadySubscribed}</p>
								<p class="text-xs text-blue-600">Già iscritti</p>
							</div>
							<div class="text-center p-2 bg-white rounded">
								<p class="text-lg font-bold text-red-700">{importResult.newsletter.failed}</p>
								<p class="text-xs text-red-600">Falliti</p>
							</div>
						</div>
						{#if importResult.newsletter.errors.length > 0}
							<div class="mt-3 text-sm text-purple-700">
								<p class="font-medium mb-1">Errori iscrizione newsletter:</p>
								<ul class="list-disc list-inside space-y-0.5 max-h-24 overflow-auto">
									{#each importResult.newsletter.errors as err}
										<li>{err.email}: {err.error}</li>
									{/each}
								</ul>
							</div>
						{/if}
					</div>
				{/if}

				<!-- Error list (if any) -->
				{#if importResult.errors.length > 0}
					<div class="p-4 bg-red-50 border border-red-200 rounded-lg">
						<h3 class="text-sm font-medium text-red-800 mb-2">Errori durante l'importazione:</h3>
						<ul class="text-sm text-red-700 space-y-1 max-h-48 overflow-auto">
							{#each importResult.errors as error}
								<li>
									Riga {error.rowNumber}: {error.email || 'email mancante'} - {error.errors.join(', ')}
								</li>
							{/each}
						</ul>
					</div>
				{/if}

				<!-- Actions -->
				<div class="flex items-center justify-between pt-4 border-t border-gray-200">
					<button
						type="button"
						onclick={resetUpload}
						class="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
					>
						Nuovo import
					</button>

					<div class="flex gap-2">
						<form
							method="POST"
							action="?/downloadReport"
							use:enhance={() => {
								isDownloading = true;
								return async ({ update }) => {
									await update();
								};
							}}
						>
							<input type="hidden" name="resultId" value={resultId} />
							<button
								type="submit"
								disabled={isDownloading}
								class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
							>
								Scarica report completo
							</button>
						</form>

						<a
							href="/admin/users"
							class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
						>
							Vai agli utenti
						</a>
					</div>
				</div>
			</div>
		{/if}
	</div>
</div>
