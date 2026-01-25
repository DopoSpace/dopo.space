<script lang="ts">
	import Checkbox from './Checkbox.svelte';
	import * as m from '$lib/paraglide/messages';

	interface Props {
		privacyConsent?: boolean;
		dataConsent?: boolean;
		privacyError?: string;
		dataError?: string;
		disabled?: boolean;
		onPrivacyBlur?: (checked: boolean) => void;
		onDataBlur?: (checked: boolean) => void;
	}

	let {
		privacyConsent = false,
		dataConsent = false,
		privacyError,
		dataError,
		disabled = false,
		onPrivacyBlur,
		onDataBlur
	}: Props = $props();
</script>

<div class="consent-section" class:consent-section-disabled={disabled}>
	<div class="consent-intro">
		<div class="trust-badge">
			<svg class="trust-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
				<path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
			</svg>
			<span>{m.consent_data_safe()}</span>
		</div>
		<p class="consent-description">
			{m.consent_intro()}
		</p>
	</div>

	<div class="consent-items">
		<div class="consent-item">
			<Checkbox
				name="privacyConsent"
				label=""
				checked={privacyConsent}
				error={privacyError}
				required
				{disabled}
				onblur={onPrivacyBlur}
			/>
			<div class="consent-label">
				<span class="consent-text">
					{@html m.consent_privacy_label().replace('Privacy Policy', '<a href="/legal/privacy" target="_blank" class="consent-link">Privacy Policy</a>')}
				</span>
				<span class="consent-required">{m.common_required()}</span>
			</div>
		</div>

		<div class="consent-item">
			<Checkbox
				name="dataConsent"
				label=""
				checked={dataConsent}
				error={dataError}
				required
				{disabled}
				onblur={onDataBlur}
			/>
			<div class="consent-label">
				<span class="consent-text">
					{m.consent_data_label()}
				</span>
				<span class="consent-required">{m.common_required()}</span>
			</div>
		</div>
	</div>

	<div class="consent-footer">
		<svg class="footer-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
			<path stroke-linecap="round" stroke-linejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
		</svg>
		<span>{m.consent_secure_connection()}</span>
	</div>
</div>

<style>
	@reference "tailwindcss";

	.consent-section {
		@apply space-y-5;
	}

	.consent-section-disabled {
		@apply opacity-60 pointer-events-none;
	}

	.consent-intro {
		@apply mb-6;
	}

	.trust-badge {
		@apply inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-50 text-green-700 text-sm font-medium mb-3;
	}

	.trust-icon {
		@apply w-4 h-4;
	}

	.consent-description {
		@apply text-gray-600 text-sm leading-relaxed;
	}

	.consent-items {
		@apply space-y-4;
	}

	.consent-item {
		@apply flex items-start gap-3 p-4 rounded-lg bg-gray-50 border border-gray-100;
	}

	.consent-item :global(.mb-6) {
		margin-bottom: 0;
	}

	.consent-label {
		@apply flex-1 pt-0.5;
	}

	.consent-text {
		@apply text-gray-700 text-sm leading-relaxed block;
	}

	.consent-text :global(.consent-link) {
		@apply text-blue-600 hover:text-blue-800 underline;
	}

	.consent-required {
		@apply text-xs text-gray-400 mt-1 block;
	}

	.consent-footer {
		@apply flex items-center justify-center gap-2 pt-4 text-xs text-gray-400;
	}

	.footer-icon {
		@apply w-3.5 h-3.5;
	}
</style>
