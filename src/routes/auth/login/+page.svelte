<script lang="ts">
	import { enhance } from '$app/forms';
	import TextContainer from '$lib/components/TextContainer.svelte';
	import type { ActionData } from './$types';

	let { form }: { form: ActionData } = $props();
	let loading = $state(false);
</script>

<div class="bg-dopoRed min-h-screen flex items-center justify-center px-4">
	<TextContainer>
		<h1 class="text-4xl md:text-5xl font-bold mb-8">Accedi</h1>

		{#if form?.success}
			<div class="bg-white text-gray-900 rounded-lg p-6 mb-6">
				<h2 class="text-2xl font-bold mb-2">Email inviata!</h2>
				<p class="text-lg">
					Controlla la tua casella di posta <strong>{form.email}</strong> e clicca sul link per
					accedere.
				</p>
				<p class="text-sm mt-4 text-gray-600">Il link scadrà tra 15 minuti.</p>
			</div>
		{:else}
			<p class="text-xl mb-8">
				Inserisci la tua email per ricevere un link di accesso. Non serve password!
			</p>

			<form
				method="POST"
				use:enhance={() => {
					loading = true;
					return async ({ update }) => {
						await update();
						loading = false;
					};
				}}
				class="bg-white rounded-lg p-6 md:p-8"
			>
				<div class="mb-6">
					<label for="email" class="label text-gray-700">Email</label>
					<input
						type="email"
						id="email"
						name="email"
						value={form?.email || ''}
						required
						class="input text-gray-900"
						placeholder="tua@email.com"
					/>
					{#if form?.errors?.email}
						<p class="text-red-600 text-sm mt-2">{form.errors.email}</p>
					{/if}
				</div>

				<button type="submit" disabled={loading} class="btn-primary w-full disabled:opacity-50">
					{loading ? 'Invio in corso...' : 'Invia link di accesso'}
				</button>
			</form>
		{/if}

		<div class="mt-6 text-center">
			<a href="/" class="underline hover:no-underline">Torna alla home</a>
		</div>
	</TextContainer>
</div>
