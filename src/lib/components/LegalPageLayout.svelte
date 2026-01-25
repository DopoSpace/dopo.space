<script lang="ts">
	import type { Snippet } from 'svelte';
	import * as m from '$lib/paraglide/messages';

	interface Props {
		title: string;
		lastUpdated: string;
		children: Snippet;
	}

	let { title, lastUpdated, children }: Props = $props();
</script>

<div class="legal-page">
	<div class="legal-container">
		<header class="legal-header">
			<a href="/" class="back-link">
				<svg class="back-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
					<path stroke-linecap="round" stroke-linejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
				</svg>
				{m.common_back_to_home()}
			</a>
			<h1 class="legal-title">{title}</h1>
			<p class="legal-updated">{m.cookie_policy_last_updated({ date: lastUpdated })}</p>
		</header>

		<main class="legal-content">
			{@render children()}
		</main>
	</div>
</div>

<style>
	@reference "tailwindcss";

	.legal-page {
		background-color: var(--color-dopoRed);
	}

	.legal-container {
		@apply w-full max-w-2xl mx-auto px-4 py-8 md:px-8 md:py-12;
	}

	.legal-header {
		@apply mb-8;
	}

	.back-link {
		@apply inline-flex items-center gap-2 text-white/80 hover:text-white transition-colors mb-6;
	}

	.back-icon {
		@apply w-5 h-5;
	}

	.legal-title {
		@apply text-2xl md:text-3xl font-bold text-white mb-2;
	}

	.legal-updated {
		@apply text-white/70 text-sm;
	}

	.legal-content {
		@apply bg-white rounded-xl p-6 md:p-10 shadow-lg;
	}

	.legal-content :global(h2) {
		@apply text-xl md:text-2xl font-bold text-gray-900 mt-8 mb-4 first:mt-0;
	}

	.legal-content :global(h3) {
		@apply text-lg md:text-xl font-semibold text-gray-800 mt-6 mb-3;
	}

	.legal-content :global(p) {
		@apply text-gray-700 leading-relaxed mb-4;
	}

	.legal-content :global(ul) {
		@apply list-disc list-inside text-gray-700 mb-4 space-y-2;
	}

	.legal-content :global(li) {
		@apply leading-relaxed;
	}

	.legal-content :global(a) {
		@apply text-blue-600 hover:text-blue-800 underline;
	}

	.legal-content :global(strong) {
		@apply font-semibold text-gray-900;
	}

	.legal-content :global(table) {
		@apply w-full border-collapse my-6;
	}

	.legal-content :global(th),
	.legal-content :global(td) {
		@apply border border-gray-200 px-4 py-2 text-left text-gray-700;
	}

	.legal-content :global(th) {
		@apply bg-gray-50 font-semibold text-gray-900;
	}

	.legal-content :global(table code) {
		@apply bg-gray-100 px-2 py-0.5 rounded text-sm font-mono text-gray-800;
	}

	.legal-content :global(.info-box) {
		@apply bg-blue-50 border border-blue-100 rounded-lg p-4 my-6;
	}

	.legal-content :global(.info-box p) {
		@apply text-blue-800 mb-0;
	}

	.legal-content :global(.warning-box) {
		@apply bg-amber-50 border border-amber-100 rounded-lg p-4 my-6;
	}

	.legal-content :global(.warning-box p) {
		@apply text-amber-800 mb-0;
	}
</style>
