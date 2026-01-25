<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { trackPaymentStart } from '$lib/analytics';

	interface Props {
		clientId: string;
		amount: number;
		currency?: string;
		showAmount?: boolean;
	}

	let { clientId, amount, currency = 'EUR', showAmount = true }: Props = $props();

	let buttonsContainer: HTMLDivElement | undefined = $state();
	let loading = $state(true);
	let error = $state<string | null>(null);
	let paypalLoaded = $state(false);
	let resetting = $state(false); // True while resetting after window close

	// Format amount for display
	const formattedAmount = $derived((amount / 100).toFixed(2));

	// Load PayPal SDK
	onMount(() => {
		loadPayPalScript();
	});

	function loadPayPalScript() {
		console.log('loadPayPalScript called', { clientId, currency });

		// Check if already loaded
		if (window.paypal) {
			console.log('PayPal already loaded');
			paypalLoaded = true;
			loading = false;
			renderButtons();
			return;
		}

		// Create script element
		const script = document.createElement('script');
		const scriptUrl = `https://www.paypal.com/sdk/js?client-id=${clientId}&currency=${currency}&locale=it_IT&disable-funding=mybank`;
		console.log('Loading PayPal SDK from:', scriptUrl);
		script.src = scriptUrl;
		script.async = true;

		script.onload = () => {
			console.log('PayPal SDK loaded successfully');
			paypalLoaded = true;
			loading = false;
			renderButtons();
		};

		script.onerror = (e) => {
			console.error('PayPal SDK failed to load', e);
			loading = false;
			error = 'Impossibile caricare il sistema di pagamento. Riprova più tardi.';
		};

		document.body.appendChild(script);
	}

	function renderButtons() {
		console.log('renderButtons called', { paypal: !!window.paypal, container: !!buttonsContainer });

		if (!window.paypal) {
			console.error('PayPal SDK not loaded');
			return;
		}

		if (!buttonsContainer) {
			console.log('Container not ready, retrying in 100ms...');
			setTimeout(renderButtons, 100);
			return;
		}

		// Clear any existing buttons
		buttonsContainer.innerHTML = '';

		console.log('Rendering PayPal buttons...');
		window.paypal.Buttons({
			style: {
				layout: 'vertical',
				color: 'gold',
				shape: 'rect',
				label: 'paypal'
			},

			// Create order on server
			createOrder: async () => {
				error = null;

				// Wait if we're still resetting from a previous window close
				if (resetting) {
					await new Promise<void>((resolve) => {
						const checkResetting = () => {
							if (!resetting) {
								resolve();
							} else {
								setTimeout(checkResetting, 100);
							}
						};
						checkResetting();
					});
				}

				trackPaymentStart(amount);

				try {
					const response = await fetch('/api/membership/create-order', {
						method: 'POST',
						headers: {
							'Content-Type': 'application/json'
						}
					});

					const data = await response.json();

					if (!response.ok) {
						throw new Error(data.message || 'Errore nella creazione del pagamento');
					}

					return data.orderId;
				} catch (err) {
					const message = err instanceof Error ? err.message : 'Errore nella creazione del pagamento';
					error = message;
					throw err;
				}
			},

			// Capture payment on server after approval
			onApprove: async (data: { orderID: string }) => {
				error = null;

				try {
					const response = await fetch('/api/membership/capture-order', {
						method: 'POST',
						headers: {
							'Content-Type': 'application/json'
						},
						body: JSON.stringify({ orderId: data.orderID })
					});

					const result = await response.json();

					if (!response.ok) {
						throw new Error(result.message || 'Errore nella conferma del pagamento');
					}

					// Navigate to success page
					goto('/membership/payment/success');
				} catch (err) {
					const message = err instanceof Error ? err.message : 'Errore nella conferma del pagamento';
					error = message;
				}
			},

			// Handle cancel
			onCancel: async () => {
				// Block new orders while we reset
				resetting = true;
				try {
					await fetch('/api/membership/cancel-order', { method: 'POST' });
				} catch (e) {
					console.error('Failed to cancel order:', e);
				} finally {
					resetting = false;
				}
				goto('/membership/payment/cancel');
			},

			// Handle errors
			onError: async (err: Error) => {
				console.error('PayPal error:', err);

				// Ignore "Window is closed" error - this happens when user closes popup
				// It's not a real error, just PayPal complaining about the closed window
				if (err?.message?.includes('Window is closed')) {
					// Block new orders while we reset
					resetting = true;
					try {
						await fetch('/api/membership/cancel-order', { method: 'POST' });
					} catch (e) {
						console.error('Failed to cancel order:', e);
					} finally {
						resetting = false;
					}
					return;
				}

				// Don't overwrite specific error messages from createOrder or onApprove
				if (!error) {
					error = 'Si è verificato un errore durante il pagamento. Riprova più tardi.';
				}
			}
		}).render(buttonsContainer);
	}

	// Retry loading
	function handleRetry() {
		error = null;
		loading = true;
		loadPayPalScript();
	}
</script>

<div class="paypal-buttons-wrapper">
	{#if loading}
		<div class="loading-state">
			<div class="spinner"></div>
			<p>Caricamento metodi di pagamento...</p>
		</div>
	{:else if error}
		<div class="error-state">
			<svg class="error-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
				<path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
			</svg>
			<p class="error-message">{error}</p>
			<button type="button" class="retry-button" onclick={handleRetry}>
				Riprova
			</button>
		</div>
	{:else}
		{#if showAmount}
			<div class="amount-summary">
				<span class="amount-label">Totale da pagare:</span>
				<span class="amount-value">{currency} {formattedAmount}</span>
			</div>
		{/if}
		<div bind:this={buttonsContainer} class="buttons-container"></div>
	{/if}
</div>

<style>
	@reference "tailwindcss";

	.paypal-buttons-wrapper {
		@apply w-full;
	}

	.loading-state {
		@apply flex flex-col items-center justify-center py-8 text-gray-500;
	}

	.spinner {
		@apply w-8 h-8 border-4 border-gray-200 border-t-blue-600 rounded-full animate-spin mb-4;
	}

	.error-state {
		@apply flex flex-col items-center justify-center py-8 text-center;
	}

	.error-icon {
		@apply w-12 h-12 text-red-500 mb-4;
	}

	.error-message {
		@apply text-red-600 mb-4;
	}

	.retry-button {
		@apply px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors;
	}

	.amount-summary {
		@apply flex justify-between items-center py-4 px-4 bg-gray-50 rounded-lg mb-4;
	}

	.amount-label {
		@apply text-gray-600;
	}

	.amount-value {
		@apply text-xl font-bold text-gray-900;
	}

	.buttons-container {
		@apply min-h-[150px];
	}
</style>
