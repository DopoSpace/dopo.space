<script lang="ts">
	import PublicPageLayout from '$lib/components/PublicPageLayout.svelte';
	import TextContainer from '$lib/components/TextContainer.svelte';

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
		}
	];
</script>

<svelte:head>
	<title>Documenti Legali - DOPO? ASD</title>
	<meta name="description" content="Documenti legali di DOPO? ASD: privacy policy, cookie policy, termini e condizioni" />
</svelte:head>

<PublicPageLayout>
	<div class="legal-page">
		<TextContainer>

			<h1>Documenti Legali</h1>
			<p>Trasparenza e protezione dei tuoi dati</p>

			<div class="legal-grid">
				{#each legalDocuments as doc}
					<a href={doc.href} class="card-link">
						<h3>{doc.title}</h3>
						<p>{doc.description}</p>
					</a>
				{/each}
			</div>

			<p style="text-align: center; margin-top: 3rem;">
				Per qualsiasi domanda sui documenti legali, contattaci a
				<a href="mailto:privacy@dopo.space">privacy@dopo.space</a>
			</p>
		</TextContainer>
	</div>
</PublicPageLayout>

<style>
	@reference "tailwindcss";

	.legal-page {
		@apply min-h-screen;
	}

	.legal-grid {
		@apply grid gap-4 md:grid-cols-2 mt-8;
	}
</style>
