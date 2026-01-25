<script lang="ts">
	import { onMount } from 'svelte';
	import PublicPageLayout from '$lib/components/PublicPageLayout.svelte';
	import TextContainer from '$lib/components/TextContainer.svelte';
	import { trackPaymentCancel } from '$lib/analytics';
	import * as m from '$lib/paraglide/messages';

	// Track payment cancellation on mount
	onMount(() => {
		trackPaymentCancel();
	});
</script>

<svelte:head>
	<title>{m.payment_canceled_title()} - Dopo Space</title>
</svelte:head>

<PublicPageLayout>
	<div class="cancel-page">
		<TextContainer>
			<h1>{m.payment_canceled_title()}</h1>
			<p>{m.payment_you_canceled()}. {m.payment_no_charge()}</p>
			<p>{@html m.payment_need_help()}</p>

			<div class="cta-section">
				<a href="/membership/checkout">
					<button type="submit">{m.payment_retry()}</button>
				</a>
			</div>
		</TextContainer>
	</div>
</PublicPageLayout>

<style>
	@reference "tailwindcss";

	.cancel-page {
		@apply min-h-screen;
	}

	.cta-section {
		@apply mt-8;
	}

	.cta-section a {
		@apply no-underline;
	}
</style>
