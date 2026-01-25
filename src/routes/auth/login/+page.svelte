<script lang="ts">
	import { enhance } from '$app/forms';
	import PublicPageLayout from '$lib/components/PublicPageLayout.svelte';
	import TextContainer from '$lib/components/TextContainer.svelte';
	import Toast from '$lib/components/Toast.svelte';
	import { trackLoginStart } from '$lib/analytics';
	import * as m from '$lib/paraglide/messages';
	import type { ActionData } from './$types';

	let { form }: { form: ActionData } = $props();
	let loading = $state(false);
	let showSuccessToast = $state(false);

	$effect(() => {
		if (form?.success) {
			showSuccessToast = true;
		}
	});
</script>

<PublicPageLayout>
	<TextContainer>
		{#if form?.success}
			<h1>{m.auth_success_title()}</h1>
			<p>{@html m.auth_success_message({ email: `<strong>${form.email}</strong>` })}</p>
			<p>{m.auth_success_hint()}</p>

			<h2>{m.auth_success_tips_title()}</h2>
			<ul>
				<li>{m.auth_success_tip_spam()}</li>
				<li>{m.auth_success_tip_verify()}</li>
				<li>{m.auth_success_tip_wait()}</li>
			</ul>

			<p>
				<a href="/auth/login">{m.auth_retry_link()}</a>
			</p>
		{:else}
			<h1>{m.auth_login_title()}</h1>
			<p>{m.auth_login_subtitle()}</p>

			<form
				method="POST"
				use:enhance={() => {
					loading = true;
					trackLoginStart();
					return async ({ update }) => {
						await update();
						loading = false;
					};
				}}
			>
				<div class="form-group">
					<input
						type="email"
						name="email"
						placeholder={m.auth_email_placeholder()}
						value={form?.email || ''}
						required
						autocomplete="email"
					/>

					{#if form?.errors?.email}
						<p class="error">{form.errors.email}</p>
					{/if}
				</div>

				<button type="submit" disabled={loading}>
					{loading ? m.auth_submit_sending() : m.auth_submit_send()}
				</button>
			</form>
		{/if}

		<p class="back-link">
			<a href="/">{m.common_back_home()}</a>
		</p>
	</TextContainer>
</PublicPageLayout>

{#if showSuccessToast}
	<Toast message={m.auth_toast_success()} type="success" onclose={() => (showSuccessToast = false)} />
{/if}
