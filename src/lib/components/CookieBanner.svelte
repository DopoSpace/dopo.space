<script lang="ts">
	import { fly } from 'svelte/transition';
	import { cookieConsent } from '$lib/stores/cookieConsent';
	import * as m from '$lib/paraglide/messages';

	interface Props {
		onAcceptAll?: () => void;
	}

	let { onAcceptAll }: Props = $props();

	function handleAcceptAll(): void {
		cookieConsent.acceptAll();
		onAcceptAll?.();
	}

	function handleAcceptNecessary(): void {
		cookieConsent.acceptNecessaryOnly();
	}
</script>

{#if $cookieConsent.showBanner}
	<div
		class="cookie-banner"
		transition:fly={{ y: 100, duration: 300 }}
		role="dialog"
		aria-label={m.cookie_banner_title()}
	>
		<div class="cookie-banner-content">
			<div class="cookie-banner-text">
				<h2 class="cookie-banner-title">{m.cookie_banner_title()}</h2>
				<p class="cookie-banner-description">{m.cookie_banner_description()}</p>
				<a href="/legal/cookies" class="cookie-banner-link">
					{m.cookie_banner_policy_link()}
				</a>
			</div>
			<div class="cookie-banner-actions">
				<button type="button" class="btn-necessary" onclick={handleAcceptNecessary}>
					{m.cookie_banner_accept_necessary()}
				</button>
				<button type="button" class="btn-accept" onclick={handleAcceptAll}>
					{m.cookie_banner_accept_all()}
				</button>
			</div>
		</div>
	</div>
{/if}

<style>
	@reference "tailwindcss";

	.cookie-banner {
		@apply fixed bottom-0 left-0 right-0 z-50 bg-gray-900 border-t border-gray-700 shadow-lg;
	}

	.cookie-banner-content {
		@apply max-w-6xl mx-auto px-4 py-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4;
	}

	.cookie-banner-text {
		@apply flex-1;
	}

	.cookie-banner-title {
		@apply text-white font-semibold text-base mb-1;
	}

	.cookie-banner-description {
		@apply text-gray-300 text-sm;
	}

	.cookie-banner-link {
		@apply text-white underline hover:text-gray-200 transition-colors text-sm mt-1 inline-block;
	}

	.cookie-banner-actions {
		@apply flex flex-col sm:flex-row gap-2 sm:gap-3;
	}

	.btn-necessary {
		@apply px-4 py-2 text-sm font-medium text-gray-300 bg-transparent border border-gray-500 rounded-lg hover:bg-gray-800 hover:text-white transition-colors;
	}

	.btn-accept {
		@apply px-4 py-2 text-sm font-medium text-gray-900 bg-white rounded-lg hover:bg-gray-100 transition-colors;
	}
</style>
