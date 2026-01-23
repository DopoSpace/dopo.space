<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import FormCard from '$lib/components/forms/FormCard.svelte';
	import WelcomeHeader from '$lib/components/forms/WelcomeHeader.svelte';
	import Button from '$lib/components/forms/Button.svelte';
	import type { PageData } from './$types';
	import { SystemState } from '$lib/types/membership';

	let { data }: { data: PageData } = $props();

	// State for polling
	let isProcessing = $state(data.isProcessing);
	let isAwaitingNumber = $state(data.isAwaitingNumber || false);
	let isActive = $state(data.isActive);
	let membershipNumber = $state(data.membershipNumber);
	let pollAttempts = $state(0);
	let pollTimedOut = $state(false);
	let pollInterval: ReturnType<typeof setInterval> | null = null;

	const MAX_POLL_ATTEMPTS = 10; // 30 seconds (3 sec interval)
	const POLL_INTERVAL = 3000; // 3 seconds

	// Start polling if payment is still processing
	onMount(() => {
		if (isProcessing) {
			startPolling();
		}
	});

	onDestroy(() => {
		stopPolling();
	});

	function startPolling() {
		pollInterval = setInterval(async () => {
			pollAttempts++;

			try {
				const response = await fetch('/api/membership/status');
				if (response.ok) {
					const status = await response.json();

					if (status.systemState === SystemState.S4_AWAITING_NUMBER) {
						isProcessing = false;
						isAwaitingNumber = true;
						stopPolling();
					} else if (status.systemState === SystemState.S5_ACTIVE) {
						isProcessing = false;
						isActive = true;
						membershipNumber = status.membershipNumber;
						stopPolling();
					}
				}
			} catch {
				// Continue polling on error
			}

			if (pollAttempts >= MAX_POLL_ATTEMPTS) {
				pollTimedOut = true;
				stopPolling();
			}
		}, POLL_INTERVAL);
	}

	function stopPolling() {
		if (pollInterval) {
			clearInterval(pollInterval);
			pollInterval = null;
		}
	}
</script>

<svelte:head>
	<title>Pagamento completato - Dopo Space</title>
</svelte:head>

<div class="success-page">
	<div class="success-container">
		<!-- Header -->
		<WelcomeHeader
			title="Pagamento"
			subtitle={isProcessing ? 'Elaborazione in corso...' : 'Grazie per il tuo acquisto!'}
			showEmail={false}
		/>

		{#if isProcessing && !pollTimedOut}
			<!-- Processing State -->
			<FormCard title="Elaborazione pagamento" icon="clock">
				<div class="processing-state">
					<div class="spinner"></div>
					<p class="processing-text">
						Stiamo verificando il tuo pagamento con PayPal.
						<br />
						Attendi qualche secondo...
					</p>
				</div>
			</FormCard>
		{:else if pollTimedOut}
			<!-- Processing Timeout -->
			<FormCard title="Pagamento in elaborazione" icon="clock">
				<div class="timeout-state">
					<svg class="timeout-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
					</svg>
					<p class="timeout-text">
						Il pagamento è ancora in elaborazione. Riceverai un'email di conferma quando sarà completato.
					</p>
					<p class="timeout-note">
						Puoi chiudere questa pagina. Ti invieremo una notifica appena la tessera sarà pronta.
					</p>
				</div>
			</FormCard>
		{:else if isAwaitingNumber}
			<!-- Payment Succeeded, Awaiting Card -->
			<FormCard title="Pagamento completato" icon="check">
				<div class="success-state">
					<div class="success-icon-wrapper">
						<svg class="success-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
						</svg>
					</div>
					<h3 class="success-title">Il tuo pagamento è stato ricevuto!</h3>
					<p class="success-text">
						Grazie per esserti iscritto a Dopo Space. Ti assegneremo un numero tessera a breve.
					</p>
					<p class="success-note">
						Riceverai un'email di conferma con tutti i dettagli della tua tessera.
					</p>
				</div>
			</FormCard>
		{:else if isActive}
			<!-- Fully Active Membership -->
			<FormCard title="Tessera attiva" icon="check">
				<div class="active-state">
					<div class="success-icon-wrapper">
						<svg class="success-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
						</svg>
					</div>
					<h3 class="success-title">La tua tessera è attiva!</h3>
					{#if membershipNumber}
						<div class="membership-number">
							<span class="number-label">Numero tessera</span>
							<span class="number-value">{membershipNumber}</span>
						</div>
					{/if}
					<p class="success-text">
						Benvenuto nella community di Dopo Space!
					</p>
				</div>
			</FormCard>
		{/if}

		<!-- CTA -->
		<div class="cta-section">
			<a href="/membership/subscription" class="cta-link">
				<Button variant="primary" fullWidth>
					Vai alla tua area riservata
				</Button>
			</a>
		</div>

		<!-- Back to Home -->
		<div class="back-link">
			<a href="/">Torna alla home</a>
		</div>
	</div>
</div>

<style>
	@reference "tailwindcss";

	.success-page {
		@apply min-h-screen;
		background-color: var(--color-dopoRed);
	}

	.success-container {
		@apply w-full max-w-2xl mx-auto px-4 py-12 md:px-8 md:py-16;
	}

	.processing-state {
		@apply flex flex-col items-center justify-center py-8 text-center;
	}

	.spinner {
		@apply w-12 h-12 border-4 border-gray-200 border-t-blue-600 rounded-full animate-spin mb-6;
	}

	.processing-text {
		@apply text-gray-600 leading-relaxed;
	}

	.timeout-state {
		@apply flex flex-col items-center justify-center py-6 text-center;
	}

	.timeout-icon {
		@apply w-16 h-16 text-amber-500 mb-4;
	}

	.timeout-text {
		@apply text-gray-700 mb-4;
	}

	.timeout-note {
		@apply text-sm text-gray-500;
	}

	.success-state,
	.active-state {
		@apply flex flex-col items-center justify-center py-6 text-center;
	}

	.success-icon-wrapper {
		@apply mb-4;
	}

	.success-icon {
		@apply w-20 h-20 text-green-500;
	}

	.success-title {
		@apply text-xl font-semibold text-gray-900 mb-3;
	}

	.success-text {
		@apply text-gray-600 mb-2;
	}

	.success-note {
		@apply text-sm text-gray-500;
	}

	.membership-number {
		@apply flex flex-col items-center gap-1 my-4 p-4 bg-green-50 rounded-lg;
	}

	.number-label {
		@apply text-sm text-green-700;
	}

	.number-value {
		@apply text-2xl font-bold text-green-800;
	}

	.cta-section {
		@apply mt-8;
	}

	.cta-link {
		@apply block;
	}

	.back-link {
		@apply mt-6 text-center;
	}

	.back-link a {
		@apply text-white/80 hover:text-white underline hover:no-underline transition-colors;
	}
</style>
