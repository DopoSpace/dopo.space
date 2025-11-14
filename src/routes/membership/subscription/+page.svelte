<script lang="ts">
	import { enhance } from '$app/forms';
	import TextContainer from '$lib/components/TextContainer.svelte';
	import FormCard from '$lib/components/forms/FormCard.svelte';
	import Input from '$lib/components/forms/Input.svelte';
	import Button from '$lib/components/forms/Button.svelte';
	import ErrorMessage from '$lib/components/forms/ErrorMessage.svelte';
	import type { PageData, ActionData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
	let loading = $state(false);
</script>

<div class="bg-dopoRed min-h-screen flex items-center justify-center px-4 py-16">
	<TextContainer>
		<h1 class="text-4xl md:text-5xl font-bold mb-4">Subscription</h1>
		<p class="text-xl mb-8">Bentornato, {data.user.email}</p>

		{#if form?.success}
			<div class="bg-white text-gray-900 rounded-lg p-6 mb-6">
				<h2 class="text-2xl font-bold mb-2 text-green-600">Dati salvati!</h2>
				<p class="text-lg">I tuoi dati sono stati salvati correttamente.</p>
			</div>
		{/if}

		<FormCard title="I tuoi dati">
			{#if form?.errors?._form}
				<ErrorMessage>{form.errors._form}</ErrorMessage>
			{/if}

			<form
				method="POST"
				use:enhance={() => {
					loading = true;
					return async ({ update }) => {
						await update();
						loading = false;
					};
				}}
			>
				<Input
					name="firstName"
					label="Nome"
					type="text"
					value={form?.values?.firstName || data.user.firstName || ''}
					error={form?.errors?.firstName}
					required
					placeholder="Mario"
				/>

				<Input
					name="lastName"
					label="Cognome"
					type="text"
					value={form?.values?.lastName || data.user.lastName || ''}
					error={form?.errors?.lastName}
					required
					placeholder="Rossi"
				/>

				<Button type="submit" variant="primary" {loading} fullWidth>
					{loading ? 'Salvataggio...' : 'Salva'}
				</Button>
			</form>
		</FormCard>

		<div class="mt-6 text-center">
			<a href="/" class="underline hover:no-underline">Torna alla home</a>
		</div>
	</TextContainer>
</div>
