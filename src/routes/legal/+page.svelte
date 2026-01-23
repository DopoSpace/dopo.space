<script lang="ts">
	import PublicPageLayout from '$lib/components/PublicPageLayout.svelte';

	const legalDocuments = [
		{
			href: '/legal/privacy',
			title: 'Privacy Policy',
			description: 'Informativa sul trattamento dei dati personali ai sensi del GDPR'
		},
		{
			href: '/legal/cookies',
			title: 'Cookie Policy',
			description: 'Informativa sull\'utilizzo dei cookie sul nostro sito'
		},
		{
			href: '/legal/terms',
			title: 'Termini e Condizioni',
			description: 'Termini e condizioni di utilizzo del servizio'
		},
		{
			href: '/legal/payments',
			title: 'Condizioni di Pagamento',
			description: 'Informazioni su pagamenti, rimborsi e quota associativa'
		}
	];
</script>

<svelte:head>
	<title>Documenti Legali - DOPO? ASD</title>
	<meta name="description" content="Documenti legali di DOPO? ASD: privacy policy, cookie policy, termini e condizioni" />
</svelte:head>

<PublicPageLayout>
	<div class="legal-index">
		<header class="legal-header">
			<a href="/" class="back-link">
				<svg class="back-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
					<path stroke-linecap="round" stroke-linejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
				</svg>
				Torna alla Home
			</a>
			<h1 class="legal-title">Documenti Legali</h1>
			<p class="legal-subtitle">
				Trasparenza e protezione dei tuoi dati
			</p>
		</header>

		<div class="legal-grid">
			{#each legalDocuments as doc}
				<a href={doc.href} class="legal-card">
					<h2 class="card-title">{doc.title}</h2>
					<p class="card-description">{doc.description}</p>
					<span class="card-arrow">
						<svg class="arrow-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path stroke-linecap="round" stroke-linejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
						</svg>
					</span>
				</a>
			{/each}
		</div>

		<div class="legal-contact">
			<p>
				Per qualsiasi domanda sui documenti legali, contattaci a
				<a href="mailto:privacy@dopo.space">privacy@dopo.space</a>
			</p>
		</div>
	</div>
</PublicPageLayout>

<style>
	@reference "tailwindcss";

	.legal-index {
		@apply w-full max-w-4xl mx-auto px-4 py-16;
	}

	.legal-header {
		@apply mb-12;
	}

	.back-link {
		@apply inline-flex items-center gap-2 text-white/80 hover:text-white transition-colors mb-6;
	}

	.back-icon {
		@apply w-5 h-5;
	}

	.legal-title {
		@apply text-4xl md:text-5xl font-bold text-white mb-3;
	}

	.legal-subtitle {
		@apply text-white/70 text-xl;
	}

	.legal-grid {
		@apply grid gap-4 md:grid-cols-2;
	}

	.legal-card {
		@apply relative bg-white rounded-xl p-6 shadow-lg hover:shadow-xl transition-all hover:-translate-y-1;
	}

	.card-title {
		@apply text-xl font-bold text-gray-900 mb-2 pr-8;
	}

	.card-description {
		@apply text-gray-600 text-sm;
	}

	.card-arrow {
		@apply absolute top-6 right-6 text-gray-400;
	}

	.arrow-icon {
		@apply w-5 h-5;
	}

	.legal-card:hover .card-arrow {
		color: var(--color-dopoRed);
	}

	.legal-contact {
		@apply mt-12 text-center text-white/70;
	}

	.legal-contact a {
		@apply text-white hover:underline;
	}
</style>
