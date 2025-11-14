<script lang="ts">
	import { enhance } from '$app/forms';
	import TextContainer from '$lib/components/TextContainer.svelte';
	import type { ActionData } from './$types';

	let { form }: { form: ActionData } = $props();
	let loading = $state(false);
</script>

<div class="bg-dopoRed min-h-screen flex items-center justify-center px-4">
	<TextContainer>
		<h1 class="text-4xl md:text-5xl font-bold mb-8">Admin Login</h1>

		<p class="text-xl mb-8">Accedi con le tue credenziali di amministratore.</p>

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
					placeholder="admin@dopo.space"
				/>
				{#if form?.errors?.email}
					<p class="text-red-600 text-sm mt-2">{form.errors.email}</p>
				{/if}
			</div>

			<div class="mb-6">
				<label for="password" class="label text-gray-700">Password</label>
				<input
					type="password"
					id="password"
					name="password"
					required
					class="input text-gray-900"
					placeholder="••••••••"
				/>
				{#if form?.errors?.password}
					<p class="text-red-600 text-sm mt-2">{form.errors.password}</p>
				{/if}
			</div>

			{#if form?.errors?.general}
				<div class="mb-6 bg-red-50 border border-red-200 rounded p-4">
					<p class="text-red-600 text-sm">{form.errors.general}</p>
				</div>
			{/if}

			<button type="submit" disabled={loading} class="btn-primary w-full disabled:opacity-50">
				{loading ? 'Accesso in corso...' : 'Accedi'}
			</button>
		</form>

		<div class="mt-6 text-center">
			<a href="/" class="underline hover:no-underline">Torna alla home</a>
		</div>
	</TextContainer>
</div>
