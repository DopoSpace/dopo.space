<script lang="ts">
	import { onMount } from 'svelte';
	import PublicPageLayout from '$lib/components/PublicPageLayout.svelte';
	import TextContainer from '$lib/components/TextContainer.svelte';
	import { trackLoginFailure } from '$lib/analytics';
	import * as m from '$lib/paraglide/messages';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	// Track login failure when error is present
	onMount(() => {
		if (data.error) {
			// Determine failure reason based on error message
			const reason = data.error.includes('scaduto') ? 'expired' : 'invalid';
			trackLoginFailure(reason);
		}
	});
</script>

<PublicPageLayout>
	<div class="verify-page">
		<TextContainer>
			{#if data.error}
				<h1>{m.auth_verify_error_title()}</h1>
				<p>{data.error}. <a href="/auth/login">{m.auth_verify_request_link()}</a></p>
			{:else}
				<div class="processing-state">
					<div class="spinner"></div>
					<p>{m.auth_verify_loading_title()}. {m.auth_verify_loading_text()}</p>
				</div>
			{/if}

			<p class="back-link">
				<a href="/">{m.common_back_to_home()}</a>
			</p>
		</TextContainer>
	</div>
</PublicPageLayout>

<style>
	@reference "tailwindcss";

	.verify-page {
		@apply min-h-screen;
	}

	.processing-state {
		@apply flex items-center gap-4;
	}
</style>
