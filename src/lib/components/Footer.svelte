<script lang="ts">
	import * as m from '$lib/paraglide/messages';

	const currentYear = new Date().getFullYear();

	const legalLinks = $derived([
		{ href: '/legal/privacy', label: m.footer_privacy() },
		{ href: '/legal/cookies', label: m.footer_cookies() },
		{ href: '/legal/terms', label: m.footer_terms() }
	]);
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
				&copy; {currentYear} {m.footer_copyright()}
			</p>
			<p class="footer-address">
				Via Boncompagni 51/10, 20139 Milano (MI) - P.IVA 13537230966
			</p>
			<p class="footer-address">
				<a href="mailto:dopolavoro.milano@gmail.com">dopolavoro.milano@gmail.com</a>
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
		@apply max-w-2xl mx-auto;
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
