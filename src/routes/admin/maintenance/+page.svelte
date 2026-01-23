<script lang="ts">
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let showConfirmDialog = $state(false);
	let loading = $state(false);
	let result = $state<{ success: boolean; processed: number; error?: string } | null>(null);

	async function runExpirationCheck() {
		loading = true;
		result = null;

		try {
			const response = await fetch('/api/admin/expire-memberships', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				}
			});

			const data = await response.json();

			if (response.ok) {
				result = { success: true, processed: data.processed };
			} else {
				result = { success: false, processed: 0, error: data.error || 'Errore sconosciuto' };
			}
		} catch (error) {
			result = { success: false, processed: 0, error: 'Errore di rete' };
		} finally {
			loading = false;
			showConfirmDialog = false;
		}
	}
</script>

<div class="space-y-6 max-w-4xl">
	<!-- Page Header -->
	<div>
		<h1 class="text-2xl font-bold text-gray-900">Manutenzione</h1>
		<p class="text-sm text-gray-600 mt-1">Strumenti di manutenzione del sistema</p>
	</div>

	<!-- Expiration Check Card -->
	<div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
		<h2 class="text-xl font-bold text-gray-900 mb-4">Controllo Scadenze Tessere</h2>

		<p class="text-sm text-gray-600 mb-4">
			Questo job viene eseguito automaticamente ogni giorno alle 5:00 (Europe/Rome).
			Usa questo pulsante per eseguire manualmente il controllo delle tessere scadute.
		</p>

		<p class="text-sm text-gray-600 mb-6">
			Per ogni tessera scaduta, il sistema:
		</p>
		<ul class="list-disc list-inside text-sm text-gray-600 mb-6 space-y-1">
			<li>Salva il numero tessera come "numero precedente"</li>
			<li>Rimuove il numero tessera attuale</li>
			<li>Imposta lo stato a "Scaduta"</li>
		</ul>

		{#if result}
			<div class="mb-6 p-4 rounded-md {result.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}">
				{#if result.success}
					<div class="flex items-center">
						<svg class="w-5 h-5 text-green-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
						</svg>
						<p class="text-sm text-green-700">
							Controllo completato. <strong>{result.processed}</strong> tessere elaborate.
						</p>
					</div>
				{:else}
					<div class="flex items-center">
						<svg class="w-5 h-5 text-red-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
						</svg>
						<p class="text-sm text-red-700">
							Errore: {result.error}
						</p>
					</div>
				{/if}
			</div>
		{/if}

		<button
			type="button"
			onclick={() => showConfirmDialog = true}
			class="btn-primary"
		>
			Esegui Controllo Scadenze
		</button>
	</div>
</div>

<!-- Confirmation Dialog -->
{#if showConfirmDialog}
	<div class="fixed inset-0 z-50 overflow-y-auto">
		<div class="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
			<div class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onclick={() => showConfirmDialog = false}></div>

			<div class="relative transform overflow-hidden rounded-lg bg-white text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg">
				<div class="bg-white px-4 pb-4 pt-5 sm:p-6 sm:pb-4">
					<div class="sm:flex sm:items-start">
						<div class="mx-auto flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-orange-100 sm:mx-0 sm:h-10 sm:w-10">
							<svg class="h-6 w-6 text-orange-600" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
								<path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
							</svg>
						</div>
						<div class="mt-3 text-center sm:ml-4 sm:mt-0 sm:text-left">
							<h3 class="text-base font-semibold leading-6 text-gray-900">Conferma Controllo Scadenze</h3>
							<div class="mt-2">
								<p class="text-sm text-gray-500">
									Sei sicuro di voler eseguire il controllo delle scadenze? Questo job elaborerà tutte le tessere
									con data di scadenza passata e le imposterà come scadute.
								</p>
							</div>
						</div>
					</div>
				</div>
				<div class="bg-gray-50 px-4 py-3 sm:flex sm:flex-row-reverse sm:px-6">
					<button
						type="button"
						onclick={runExpirationCheck}
						disabled={loading}
						class="inline-flex w-full justify-center rounded-md bg-orange-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-orange-500 sm:ml-3 sm:w-auto disabled:opacity-50"
					>
						{loading ? 'Esecuzione...' : 'Conferma'}
					</button>
					<button
						type="button"
						onclick={() => showConfirmDialog = false}
						disabled={loading}
						class="mt-3 inline-flex w-full justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:mt-0 sm:w-auto disabled:opacity-50"
					>
						Annulla
					</button>
				</div>
			</div>
		</div>
	</div>
{/if}
