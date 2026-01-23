<script lang="ts">
	import FormCard from '$lib/components/forms/FormCard.svelte';
	import WelcomeHeader from '$lib/components/forms/WelcomeHeader.svelte';
	import PayPalButtons from '$lib/components/PayPalButtons.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	// Format amount for display
	const formattedAmount = $derived((data.fee / 100).toFixed(2));
</script>

<svelte:head>
	<title>Pagamento - Dopo Space</title>
</svelte:head>

<div class="checkout-page">
	<div class="checkout-container">
		<!-- Header -->
		<WelcomeHeader
			title="Pagamento"
			subtitle="Completa il pagamento della tua tessera"
			showEmail={false}
		/>

		<!-- Order Summary -->
		<FormCard title="Riepilogo ordine" icon="receipt">
			<div class="order-summary">
				<div class="order-line">
					<span class="order-item">Tessera Dopo Space 2025</span>
					<span class="order-price">&euro;{formattedAmount}</span>
				</div>
				<div class="order-divider"></div>
				<div class="order-total">
					<span class="total-label">Totale</span>
					<span class="total-price">&euro;{formattedAmount}</span>
				</div>
			</div>
		</FormCard>

		<!-- Payment Method -->
		<FormCard title="Metodo di pagamento" icon="credit-card">
			<PayPalButtons
				clientId={data.paypalClientId}
				amount={data.fee}
			/>
		</FormCard>

		<!-- Back Link -->
		<div class="back-link">
			<a href="/membership/subscription">
				<svg class="back-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
					<path stroke-linecap="round" stroke-linejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
				</svg>
				Torna al profilo
			</a>
		</div>
	</div>
</div>

<style>
	@reference "tailwindcss";

	.checkout-page {
		@apply min-h-screen;
		background-color: var(--color-dopoRed);
	}

	.checkout-container {
		@apply w-full max-w-2xl mx-auto px-4 py-12 md:px-8 md:py-16;
	}

	.order-summary {
		@apply space-y-4;
	}

	.order-line {
		@apply flex justify-between items-center;
	}

	.order-item {
		@apply text-gray-700;
	}

	.order-price {
		@apply text-gray-900 font-medium;
	}

	.order-divider {
		@apply border-t border-gray-200;
	}

	.order-total {
		@apply flex justify-between items-center pt-2;
	}

	.total-label {
		@apply text-lg font-semibold text-gray-900;
	}

	.total-price {
		@apply text-xl font-bold text-gray-900;
	}

	.back-link {
		@apply mt-8 text-center;
	}

	.back-link a {
		@apply inline-flex items-center gap-2 text-white/80 hover:text-white transition-colors;
	}

	.back-icon {
		@apply w-5 h-5;
	}
</style>
