<script lang="ts">
	import { goto } from '$app/navigation';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

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

	function formatDate(isoString: string): string {
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
	</main>
</div>
