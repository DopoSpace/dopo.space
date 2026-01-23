<script lang="ts">
	import type { Snippet } from 'svelte';

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
				Torna alla Home
			</a>
			<h1 class="legal-title">{title}</h1>
			<p class="legal-updated">Ultimo aggiornamento: {lastUpdated}</p>
		</header>

		<main class="legal-content">
			{@render children()}
		</main>

		<footer class="legal-footer">
			<nav class="legal-nav">
				<a href="/legal/privacy">Privacy Policy</a>
				<a href="/legal/cookies">Cookie Policy</a>
				<a href="/legal/terms">Termini e Condizioni</a>
				<a href="/legal/payments">Condizioni di Pagamento</a>
							</nav>
			<p class="legal-copyright">
				&copy; {new Date().getFullYear()} DOPO? ASD - Tutti i diritti riservati
			</p>
		</footer>
	</div>
</div>

<style>
	@reference "tailwindcss";

	.legal-page {
		@apply min-h-screen;
		background-color: var(--color-dopoRed);
	}

	.legal-container {
		@apply w-full max-w-4xl mx-auto px-4 py-8 md:px-8 md:py-12;
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
		@apply text-3xl md:text-4xl font-bold text-white mb-2;
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

	.legal-footer {
		@apply mt-8 pt-6 border-t border-white/20;
	}

	.legal-nav {
		@apply flex flex-wrap gap-4 justify-center mb-4;
	}

	.legal-nav a {
		@apply text-white/70 hover:text-white text-sm transition-colors;
	}

	.legal-copyright {
		@apply text-center text-white/50 text-xs;
	}
</style>
