<script lang="ts">
	import FormCard from '$lib/components/forms/FormCard.svelte';
	import WelcomeHeader from '$lib/components/forms/WelcomeHeader.svelte';
	import Button from '$lib/components/forms/Button.svelte';
</script>

<svelte:head>
	<title>Pagamento annullato - Dopo Space</title>
</svelte:head>

<div class="cancel-page">
	<div class="cancel-container">
		<!-- Header -->
		<WelcomeHeader
			title="Pagamento annullato"
			subtitle="Il pagamento non è stato completato"
			showEmail={false}
		/>

		<!-- Cancel Message -->
		<FormCard title="Pagamento non effettuato" icon="x-circle">
			<div class="cancel-state">
				<div class="cancel-icon-wrapper">
					<svg class="cancel-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
					</svg>
				</div>
				<h3 class="cancel-title">Hai annullato il pagamento</h3>
				<p class="cancel-text">
					Non è stato effettuato alcun addebito sulla tua carta o conto PayPal.
				</p>
				<p class="cancel-note">
					Se hai avuto problemi con il pagamento o hai bisogno di assistenza, contattaci a <a href="mailto:info@dopo.space">info@dopo.space</a>
				</p>
			</div>
		</FormCard>

		<!-- CTA Buttons -->
		<div class="cta-section">
			<a href="/membership/checkout" class="cta-link">
				<Button variant="primary" fullWidth>
					Riprova il pagamento
				</Button>
			</a>
			<a href="/membership/subscription" class="secondary-link">
				Modifica il profilo
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

	.cancel-page {
		@apply min-h-screen;
		background-color: var(--color-dopoRed);
	}

	.cancel-container {
		@apply w-full max-w-2xl mx-auto px-4 py-12 md:px-8 md:py-16;
	}

	.cancel-state {
		@apply flex flex-col items-center justify-center py-6 text-center;
	}

	.cancel-icon-wrapper {
		@apply mb-4;
	}

	.cancel-icon {
		@apply w-20 h-20 text-amber-500;
	}

	.cancel-title {
		@apply text-xl font-semibold text-gray-900 mb-3;
	}

	.cancel-text {
		@apply text-gray-600 mb-4;
	}

	.cancel-note {
		@apply text-sm text-gray-500;
	}

	.cancel-note a {
		@apply text-blue-600 hover:underline;
	}

	.cta-section {
		@apply mt-8 space-y-4;
	}

	.cta-link {
		@apply block;
	}

	.secondary-link {
		@apply block text-center text-white/80 hover:text-white underline hover:no-underline transition-colors;
	}

	.back-link {
		@apply mt-6 text-center;
	}

	.back-link a {
		@apply text-white/80 hover:text-white underline hover:no-underline transition-colors;
	}
</style>
