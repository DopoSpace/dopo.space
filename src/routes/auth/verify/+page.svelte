<script lang="ts">
	import { enhance } from '$app/forms';
	import { onMount } from 'svelte';
	import PublicPageLayout from '$lib/components/PublicPageLayout.svelte';
	import TextContainer from '$lib/components/TextContainer.svelte';
	import { trackLoginFailure } from '$lib/analytics';
	import * as m from '$lib/paraglide/messages';
	import type { PageData, ActionData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	const error = $derived(data.error || form?.error);

	let formEl: HTMLFormElement | undefined = $state();

	onMount(() => {
		if (error) {
			const reason = error.includes('scaduto') || error.includes('expired') ? 'expired' : 'invalid';
			trackLoginFailure(reason);
		}

		// Auto-submit for real users (JS-enabled browsers).
		// Email client link previews don't execute JS, so they won't trigger
		// the POST that consumes the one-time token.
		if (data.token && !error && formEl) {
			formEl.requestSubmit();
		}
	});
</script>

<PublicPageLayout>
	<div class="verify-page">
		<TextContainer>
			{#if error}
				<h1>{m.auth_verify_error_title()}</h1>
				<p>{error} <a href="/auth/login">{m.auth_verify_request_link()}</a></p>
			{:else if data.token}
				<div class="processing-state">
					<div class="spinner"></div>
					<p>{m.auth_verify_loading_title()} {m.auth_verify_loading_text()}</p>
				</div>
				<form method="POST" use:enhance bind:this={formEl}>
					<input type="hidden" name="token" value={data.token} />
					<noscript>
						<button type="submit" class="verify-button">
							{m.auth_verify_confirm_button()}
						</button>
					</noscript>
				</form>
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

	.verify-button {
		@apply mt-4 inline-block rounded-lg bg-red-600 px-6 py-3 text-white no-underline hover:bg-red-700;
	}
</style>
