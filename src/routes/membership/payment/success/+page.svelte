<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import PublicPageLayout from '$lib/components/PublicPageLayout.svelte';
	import TextContainer from '$lib/components/TextContainer.svelte';
	import { trackPaymentSuccess } from '$lib/analytics';
	import type { PageData } from './$types';
	import { SystemState } from '$lib/types/membership';
	import * as m from '$lib/paraglide/messages';

	let { data }: { data: PageData } = $props();
	let paymentTracked = false;

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
		// Track payment success if already in success state on mount
		if ((isAwaitingNumber || isActive) && !paymentTracked) {
			paymentTracked = true;
			trackPaymentSuccess(data.fee);
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
						// Track payment success when poll confirms it
						if (!paymentTracked) {
							paymentTracked = true;
							trackPaymentSuccess(data.fee);
						}
					} else if (status.systemState === SystemState.S5_ACTIVE) {
						isProcessing = false;
						isActive = true;
						membershipNumber = status.membershipNumber;
						stopPolling();
						// Track payment success when poll confirms it
						if (!paymentTracked) {
							paymentTracked = true;
							trackPaymentSuccess(data.fee);
						}
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
	<title>{m.payment_success_title()} - Dopo Space</title>
</svelte:head>

<PublicPageLayout>
	<div class="success-page">
		<TextContainer>
			<h1>{m.checkout_title()}</h1>
			<p>{isProcessing ? m.payment_processing() : m.payment_success_thank_you()}</p>

			{#if isProcessing && !pollTimedOut}
				<!-- Processing State - keep spinner -->
				<div class="processing-state">
					<div class="spinner"></div>
					<p>{m.payment_processing_title()}. {m.payment_verifying_paypal()} {m.payment_wait_seconds()}</p>
				</div>
			{:else if pollTimedOut}
				<p>{m.payment_processing_title()}. {m.payment_timeout_message()} {m.payment_timeout_note()}</p>
			{:else if isAwaitingNumber}
				<p>{m.payment_received()}. {m.payment_awaiting_number()} {m.payment_confirmation_email()}</p>
			{:else if isActive}
				<p>
					{m.payment_card_active()}.
					{#if membershipNumber}
						{m.membership_card_number()}: {membershipNumber}.
					{/if}
					{m.payment_welcome_community()}
				</p>
			{/if}

			<div class="cta-section">
				<a href="/membership/subscription">
					<button type="submit">{m.payment_go_to_reserved_area()}</button>
				</a>
			</div>

			<p class="back-link">
				<a href="/">{m.common_back_to_home()}</a>
			</p>
		</TextContainer>
	</div>
</PublicPageLayout>

<style>
	@reference "tailwindcss";

	.success-page {
		@apply min-h-screen;
	}

	.processing-state {
		@apply flex items-center gap-4;
	}

	.cta-section {
		@apply mt-8;
	}

	.cta-section a {
		@apply no-underline;
	}
</style>
