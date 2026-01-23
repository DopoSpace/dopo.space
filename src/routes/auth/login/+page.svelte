<script lang="ts">
	import { enhance } from '$app/forms';
	import FormCard from '$lib/components/forms/FormCard.svelte';
	import Input from '$lib/components/forms/Input.svelte';
	import Button from '$lib/components/forms/Button.svelte';
	import WelcomeHeader from '$lib/components/forms/WelcomeHeader.svelte';
	import Toast from '$lib/components/Toast.svelte';
	import type { ActionData } from './$types';

	let { form }: { form: ActionData } = $props();
	let loading = $state(false);
	let showSuccessToast = $state(false);

	// Show toast when magic link is sent
	$effect(() => {
		if (form?.success) {
			showSuccessToast = true;
		}
	});
</script>

<div class="login-page">
	<div class="form-container">
		<!-- Welcome Header -->
		<WelcomeHeader
			title="Accedi"
			subtitle="Inserisci la tua email per ricevere un link di accesso"
			showAvatar={false}
			showEmail={false}
		/>

		{#if form?.success}
			<!-- Success State -->
			<FormCard title="Email inviata!" icon="check" subtitle="Controlla la tua casella di posta">
				<div class="success-content">
					<p class="success-email">
						Abbiamo inviato un link di accesso a <strong>{form.email}</strong>
					</p>
					<p class="success-hint">
						Clicca sul link nell'email per accedere. Il link scadra tra 15 minuti.
					</p>
					<div class="success-tips">
						<p class="tips-title">Non trovi l'email?</p>
						<ul class="tips-list">
							<li>Controlla la cartella spam o posta indesiderata</li>
							<li>Verifica che l'indirizzo email sia corretto</li>
							<li>Attendi qualche minuto e riprova</li>
						</ul>
					</div>
				</div>
			</FormCard>

			<div class="retry-section">
				<a href="/auth/login" class="retry-link">Invia un nuovo link</a>
			</div>
		{:else}
			<!-- Login Form -->
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
				<FormCard title="Email" icon="user" subtitle="Non serve password, ti invieremo un link magico">
					<Input
						name="email"
						label="Indirizzo Email"
						type="email"
						value={form?.email || ''}
						error={form?.errors?.email}
						required
						placeholder="tua@email.com"
					/>
				</FormCard>

				<div class="submit-section">
					<Button type="submit" variant="primary" {loading} fullWidth>
						{loading ? 'Invio in corso...' : 'Invia link di accesso'}
					</Button>
				</div>
			</form>
		{/if}

		<div class="back-link">
			<a href="/">Torna alla home</a>
		</div>
	</div>
</div>

{#if showSuccessToast}
	<Toast
		message="Link di accesso inviato! Controlla la tua email."
		type="success"
		onclose={() => showSuccessToast = false}
	/>
{/if}

<style>
	@reference "tailwindcss";

	.login-page {
		@apply min-h-screen;
		background-color: var(--color-dopoRed);
	}

	.form-container {
		@apply w-full max-w-6xl mx-auto px-4 py-12 md:px-8 md:py-16 lg:px-12;
	}

	.submit-section {
		@apply mt-2;
	}

	.back-link {
		@apply mt-8 text-center;
	}

	.back-link a {
		@apply text-white/80 hover:text-white underline hover:no-underline transition-colors;
	}

	/* Success state styles */
	.success-content {
		@apply space-y-4;
	}

	.success-email {
		@apply text-gray-900 text-lg;
	}

	.success-email strong {
		@apply font-semibold text-blue-600;
	}

	.success-hint {
		@apply text-gray-600;
	}

	.success-tips {
		@apply mt-6 p-4 bg-gray-50 rounded-lg border border-gray-100;
	}

	.tips-title {
		@apply font-medium text-gray-700 mb-2;
	}

	.tips-list {
		@apply text-sm text-gray-600 space-y-1 list-disc list-inside;
	}

	.retry-section {
		@apply mt-6 text-center;
	}

	.retry-link {
		@apply inline-flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-sm rounded-lg text-white hover:bg-white/20 transition-colors;
		border: 1px solid rgba(255, 255, 255, 0.2);
	}
</style>
