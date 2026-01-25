<script lang="ts">
	import { onMount } from 'svelte';
	import PublicPageLayout from '$lib/components/PublicPageLayout.svelte';
	import TextContainer from '$lib/components/TextContainer.svelte';
	import PayPalButtons from '$lib/components/PayPalButtons.svelte';
	import { trackCheckoutView } from '$lib/analytics';
	import type { PageData } from './$types';
	import * as m from '$lib/paraglide/messages';

	let { data }: { data: PageData } = $props();

	// Format amount for display
	const formattedAmount = $derived((data.fee / 100).toFixed(2));

	// Track checkout view on mount
	onMount(() => {
		trackCheckoutView(data.fee);
	});
</script>

<svelte:head>
	<title>{m.checkout_title()} - Dopo Space</title>
</svelte:head>

<PublicPageLayout>
	<div class="checkout-page">
		<TextContainer>
			<h1>{m.checkout_title()}</h1>
			<p>{m.checkout_subtitle()}</p>

			<!-- Order Summary -->
			<div class="form-section">
				<h2 class="form-section-title">{m.checkout_order_summary()}</h2>
				<div class="order-summary">
					<div class="order-line">
						<span>{m.checkout_membership_card()}</span>
						<span class="order-price">&euro;{formattedAmount}</span>
					</div>
					<div class="order-divider"></div>
					<div class="order-total">
						<span>{m.checkout_total()}</span>
						<span class="total-price">&euro;{formattedAmount}</span>
					</div>
				</div>
			</div>

			<!-- Payment Method -->
			<div class="form-section">
				<h2 class="form-section-title">{m.checkout_payment_method()}</h2>
				<div class="paypal-container">
					<PayPalButtons
						clientId={data.paypalClientId}
						amount={data.fee}
						showAmount={false}
					/>
				</div>
			</div>

			<!-- Back Link -->
			<p class="back-link">
				<a href="/membership/subscription">
					← {m.checkout_back_to_profile()}
				</a>
			</p>
		</TextContainer>
	</div>
</PublicPageLayout>

<style>
	@reference "tailwindcss";

	.checkout-page {
		@apply min-h-screen;
	}

	.order-summary {
		@apply space-y-4;
	}

	.order-line {
		@apply flex justify-between items-center text-white/90;
	}

	.order-price {
		@apply text-white font-medium;
	}

	.order-divider {
		@apply border-t border-white/30;
	}

	.order-total {
		@apply flex justify-between items-center pt-2 text-white;
	}

	.total-price {
		@apply text-2xl font-bold;
	}

	.paypal-container {
		@apply mt-4;
	}

	/* Override PayPal buttons wrapper for dark theme */
	.paypal-container :global(.paypal-buttons-wrapper) {
		@apply bg-white/10 rounded-lg p-6;
	}

	.paypal-container :global(.buttons-container) {
		@apply w-full;
	}

	.paypal-container :global(.paypal-button-container) {
		min-width: 100% !important;
		max-width: 100% !important;
		width: 100% !important;
	}

	.paypal-container :global([data-uid-paypalbuttons]),
	.paypal-container :global(.paypal-buttons),
	.paypal-container :global(.zoid-component-frame) {
		width: 100% !important;
	}

	.paypal-container :global(.secure-note) {
		@apply text-white/60 justify-center;
	}

	.paypal-container :global(.secure-note svg) {
		@apply text-white/60;
	}

	.paypal-container :global(.loading-state) {
		@apply text-white/70;
	}

	.paypal-container :global(.spinner) {
		@apply border-white/30 border-t-white;
	}

	.paypal-container :global(.error-state) {
		@apply text-white;
	}

	.paypal-container :global(.error-icon) {
		@apply text-amber-400;
	}

	.paypal-container :global(.error-message) {
		@apply text-amber-300;
	}

	.paypal-container :global(.retry-button) {
		@apply bg-white hover:bg-white/90;
		color: var(--color-dopoRed);
	}
</style>
