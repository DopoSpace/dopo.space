<script lang="ts">
	const currentYear = new Date().getFullYear();

	const legalLinks = [
		{ href: '/legal/privacy', label: 'Privacy Policy' },
		{ href: '/legal/cookies', label: 'Cookie Policy' },
		{ href: '/legal/terms', label: 'Termini e Condizioni' },
		{ href: '/legal/payments', label: 'Condizioni di Pagamento' }
	];
</script>

<footer class="footer">
	<div class="footer-container">
		<nav class="footer-nav">
			{#each legalLinks as { href, label }}
				<a {href} class="footer-link">{label}</a>
			{/each}
		</nav>

		<div class="footer-divider"></div>

		<div class="footer-bottom">
			<p class="footer-copyright">
				&copy; {currentYear} DOPO? ASD - Tutti i diritti riservati
			</p>
			<p class="footer-address">
				Via Example 123, 20100 Milano (MI) - <a href="mailto:info@dopo.space">info@dopo.space</a>
			</p>
		</div>
	</div>
</footer>

<style>
	@reference "tailwindcss";

	.footer {
		@apply mt-auto py-8 px-4;
		background-color: rgba(0, 0, 0, 0.1);
	}

	.footer-container {
		@apply max-w-4xl mx-auto;
	}

	.footer-nav {
		@apply flex flex-wrap justify-center gap-x-6 gap-y-2 mb-4;
	}

	.footer-link {
		@apply text-white/70 hover:text-white text-sm transition-colors;
	}

	.footer-divider {
		@apply border-t border-white/20 my-4;
	}

	.footer-bottom {
		@apply text-center;
	}

	.footer-copyright {
		@apply text-white/50 text-xs mb-1;
	}

	.footer-address {
		@apply text-white/40 text-xs;
	}

	.footer-address a {
		@apply hover:text-white/60 transition-colors;
	}
</style>
