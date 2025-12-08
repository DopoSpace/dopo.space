<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageData } from './$types';
	import type { AutoAssignResult } from '$lib/server/services/membership';

	// Explicit type for form action data
	type AssignCardsFormData = {
		success?: boolean;
		result?: AutoAssignResult;
		errors?: {
			_form?: string;
			userIds?: string;
		};
	} | null;

	let { data, form }: { data: PageData; form: AssignCardsFormData } = $props();

	// Batch assignment state
	let selectedUserIds = $state<string[]>([]);
	let loading = $state(false);

	// Reactive: select all checkbox state
	let allSelected = $derived(
		data.usersAwaitingCard.length > 0 &&
		selectedUserIds.length === data.usersAwaitingCard.length
	);

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
			<div class="flex items-center justify-between flex-wrap gap-2">
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
		</div>

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
					return async ({ update }) => {
						await update({ invalidateAll: true, reset: false });
						loading = false;
						selectedUserIds = [];
					};
				}}
			>
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

				<!-- Selection Count and Submit -->
				<div class="flex items-center justify-between flex-wrap gap-4">
					<p class="text-sm text-gray-600">
						{selectedUserIds.length} utenti selezionati
						{#if selectedUserIds.length > data.availableNumbersCount}
							<span class="text-red-600 ml-2">
								(solo {data.availableNumbersCount} numeri disponibili!)
							</span>
						{/if}
					</p>
					<button
						type="submit"
						disabled={loading || selectedUserIds.length === 0 || data.availableNumbersCount === 0}
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
