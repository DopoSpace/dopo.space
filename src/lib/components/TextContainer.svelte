<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		children: Snippet;
	}

	let { children }: Props = $props();
</script>

<div class="text-container">
	{@render children()}
</div>

<style>
	@reference "tailwindcss";

	.text-container {
		@apply w-full px-4 py-16;
		@apply md:w-4/5;
	}

	/* Headings */
	:global(.text-container h1) {
		@apply text-4xl md:text-5xl font-bold text-white mb-8 leading-tight;
	}

	:global(.text-container h2) {
		@apply text-2xl md:text-3xl font-bold text-white mt-12 mb-4 leading-tight;
	}

	:global(.text-container h2:first-child) {
		@apply mt-0;
	}

	:global(.text-container h1 + h2) {
		@apply mt-0;
	}

	/* Paragraphs */
	:global(.text-container p) {
		@apply text-xl md:text-2xl text-white/90 leading-relaxed mb-6;
	}

	:global(.text-container p:last-child) {
		@apply mb-0;
	}

	/* Lists */
	:global(.text-container ul:not(.listbox-options)),
	:global(.text-container ol) {
		@apply text-xl md:text-2xl text-white/90 leading-relaxed mb-6 pl-6 space-y-2;
	}

	:global(.text-container ul:not(.listbox-options)) {
		@apply list-disc;
	}

	:global(.text-container ol) {
		@apply list-decimal;
	}

	:global(.text-container li:not(.listbox-option)) {
		@apply pl-2;
	}

	/* Links */
	:global(.text-container a) {
		@apply text-white underline decoration-white/50 underline-offset-4 hover:decoration-white transition-colors;
	}

	/* Strong/Bold */
	:global(.text-container strong) {
		@apply font-semibold text-white;
	}

	/* Emphasis */
	:global(.text-container em) {
		@apply italic;
	}

	/* Form Elements */
	:global(.text-container form) {
		@apply mt-8 space-y-6;
	}

	:global(.text-container input[type='email']),
	:global(.text-container input[type='text']),
	:global(.text-container input[type='tel']) {
		@apply w-full px-4 py-4 text-xl md:text-2xl;
		@apply bg-transparent border-2 border-white/50 rounded-lg;
		@apply text-white placeholder-white/50;
		@apply focus:border-white focus:outline-none focus:ring-0;
	}

	:global(.text-container label) {
		@apply block text-lg md:text-xl text-white/90 mb-2;
	}

	:global(.text-container button[type='submit']) {
		@apply w-full px-6 py-4 text-xl md:text-2xl font-bold mt-4;
		@apply bg-white rounded-lg cursor-pointer;
		@apply hover:bg-white/90 transition-colors;
		@apply disabled:opacity-50 disabled:cursor-not-allowed;
		color: var(--color-dopoRed);
	}

	:global(.text-container .error) {
		@apply text-amber-300 text-base mt-2;
	}

	:global(.text-container .form-group) {
		@apply space-y-2;
	}

	:global(.text-container .back-link) {
		@apply text-base mt-12;
	}

	/* Select */
	:global(.text-container select) {
		@apply w-full px-4 py-4 text-xl md:text-2xl;
		@apply bg-transparent border-2 border-white/50 rounded-lg;
		@apply text-white;
		@apply focus:border-white focus:outline-none focus:ring-0;
		@apply appearance-none cursor-pointer;
		background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='white' stroke-width='2'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E");
		background-repeat: no-repeat;
		background-position: right 1rem center;
		background-size: 1.5rem;
		padding-right: 3rem;
	}

	:global(.text-container select option) {
		@apply text-white;
		background-color: var(--color-dopoRed-dark);
	}

	/* Input date (date picker styling) */
	:global(.text-container input[type='date']) {
		@apply w-full px-4 py-4 text-xl md:text-2xl;
		@apply bg-transparent border-2 border-white/50 rounded-lg;
		@apply text-white;
		@apply focus:border-white focus:outline-none focus:ring-0;
	}

	:global(.text-container input[type='date']::-webkit-calendar-picker-indicator) {
		filter: invert(1);
		cursor: pointer;
	}

	/* Checkbox container */
	:global(.text-container .checkbox-group) {
		@apply flex items-start gap-3;
	}

	:global(.text-container input[type='checkbox']) {
		@apply w-6 h-6 min-w-[1.5rem] mt-1;
		@apply bg-transparent border-2 border-white/50 rounded;
		@apply cursor-pointer;
		accent-color: white;
	}

	:global(.text-container input[type='checkbox']:checked) {
		@apply bg-white border-white;
	}

	:global(.text-container input[type='checkbox']:focus) {
		@apply outline-none ring-2 ring-white/50 ring-offset-0;
	}

	:global(.text-container .checkbox-label) {
		@apply text-lg md:text-xl text-white/90 leading-relaxed cursor-pointer;
	}

	/* Form section dividers */
	:global(.text-container .form-section) {
		@apply border-t border-white/20 pt-8 mt-8;
	}

	:global(.text-container .form-section-title) {
		@apply text-xl md:text-2xl font-bold text-white mb-4;
	}

	/* Info/Warning boxes */
	:global(.text-container .info-box) {
		@apply bg-white/10 border border-white/30 rounded-lg p-4 my-6;
	}

	:global(.text-container .info-box p) {
		@apply text-white/90 text-base md:text-lg mb-0;
	}

	:global(.text-container .warning-box) {
		@apply bg-amber-500/20 border border-amber-400/50 rounded-lg p-4 my-6;
	}

	:global(.text-container .warning-box p) {
		@apply text-amber-100 text-base md:text-lg mb-0;
	}

	/* Success box */
	:global(.text-container .success-box) {
		@apply bg-green-500/20 border border-green-400/50 rounded-lg p-4 my-6;
	}

	:global(.text-container .success-box p) {
		@apply text-green-100 text-base md:text-lg mb-0;
	}

	/* Tables (for legal pages) */
	:global(.text-container table) {
		@apply w-full border-collapse my-6;
	}

	:global(.text-container th),
	:global(.text-container td) {
		@apply border border-white/30 px-4 py-3 text-left text-white/90;
	}

	:global(.text-container th) {
		@apply bg-white/10 font-semibold text-white;
	}

	:global(.text-container table code) {
		@apply bg-white/20 px-2 py-0.5 rounded text-sm font-mono text-white;
	}

	/* Grid layouts */
	:global(.text-container .grid) {
		@apply grid gap-4;
	}

	:global(.text-container .grid-cols-2) {
		@apply grid-cols-1 md:grid-cols-2;
	}

	:global(.text-container .grid-cols-3) {
		@apply grid-cols-1 md:grid-cols-3;
	}

	/* Spinner */
	:global(.text-container .spinner) {
		@apply w-12 h-12 border-4 border-white/30 border-t-white rounded-full animate-spin;
	}

	/* Card links (for legal index) */
	:global(.text-container .card-link) {
		@apply block p-6 bg-white/10 border border-white/30 rounded-lg;
		@apply hover:bg-white/20 hover:border-white/50 transition-all;
	}

	:global(.text-container .card-link h3) {
		@apply text-xl font-bold text-white mb-2;
	}

	:global(.text-container .card-link p) {
		@apply text-white/70 text-base mb-0;
	}

	/* Button secondary (white outline) */
	:global(.text-container button.secondary),
	:global(.text-container .btn-secondary) {
		@apply w-full px-6 py-4 text-xl md:text-2xl font-bold mt-4;
		@apply bg-transparent border-2 border-white rounded-lg cursor-pointer text-white;
		@apply hover:bg-white/10 transition-colors;
		@apply disabled:opacity-50 disabled:cursor-not-allowed;
	}

	/* Disabled input state */
	:global(.text-container input:disabled),
	:global(.text-container select:disabled) {
		@apply opacity-50 cursor-not-allowed;
	}
</style>
