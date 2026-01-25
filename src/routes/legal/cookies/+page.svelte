<script lang="ts">
	import PublicPageLayout from '$lib/components/PublicPageLayout.svelte';
	import TextContainer from '$lib/components/TextContainer.svelte';
	import { cookieConsent } from '$lib/stores/cookieConsent';
	import * as m from '$lib/paraglide/messages';
</script>

<svelte:head>
	<title>{m.cookie_policy_title()} - APS Dopolavoro</title>
	<meta name="description" content={m.cookie_policy_intro()} />
</svelte:head>

<PublicPageLayout>
	<div class="legal-page">
		<TextContainer>
			<h1>{m.cookie_policy_title()}</h1>
			<p style="opacity: 0.7; font-size: 1rem;">{m.cookie_policy_last_updated({ date: '24 Gennaio 2026' })}</p>

			<h2>1. {m.cookie_policy_what_title()}</h2>
			<p>{m.cookie_policy_what_text()}</p>

			<h2>2. {m.cookie_policy_technical_title()}</h2>
			<p>{m.cookie_policy_technical_desc()}</p>

			<table>
				<thead>
					<tr>
						<th>{m.cookie_table_name()}</th>
						<th>{m.cookie_table_purpose()}</th>
						<th>{m.cookie_table_duration()}</th>
						<th>{m.cookie_table_consent()}</th>
					</tr>
				</thead>
				<tbody>
					<tr>
						<td><code>dopo_session</code></td>
						<td>{m.cookie_dopo_session_purpose()}</td>
						<td>{m.cookie_table_7days()}</td>
						<td>{m.cookie_table_no()}</td>
					</tr>
					<tr>
						<td><code>dopo_admin_session</code></td>
						<td>{m.cookie_dopo_admin_session_purpose()}</td>
						<td>{m.cookie_table_7days()}</td>
						<td>{m.cookie_table_no()}</td>
					</tr>
					<tr>
						<td><code>cookie_consent</code></td>
						<td>{m.cookie_consent_purpose()}</td>
						<td>{m.cookie_table_1year()}</td>
						<td>{m.cookie_table_no()}</td>
					</tr>
					<tr>
						<td><code>dopo_locale</code></td>
						<td>{m.cookie_dopo_locale_purpose()}</td>
						<td>{m.cookie_table_1year()}</td>
						<td>{m.cookie_table_no()}</td>
					</tr>
				</tbody>
			</table>

			<h2>3. {m.cookie_policy_analytics_title()}</h2>
			<p>{m.cookie_policy_analytics_desc()}</p>

			<table>
				<thead>
					<tr>
						<th>{m.cookie_table_name()}</th>
						<th>{m.cookie_table_purpose()}</th>
						<th>{m.cookie_table_duration()}</th>
						<th>{m.cookie_table_consent()}</th>
					</tr>
				</thead>
				<tbody>
					<tr>
						<td><code>_ga</code>, <code>_ga_*</code></td>
						<td>{m.cookie_ga_purpose()}</td>
						<td>{m.cookie_table_2years()}</td>
						<td><strong>{m.cookie_table_yes()}</strong></td>
					</tr>
					<tr>
						<td><code>_gid</code></td>
						<td>{m.cookie_ga_purpose()}</td>
						<td>{m.cookie_table_24hours()}</td>
						<td><strong>{m.cookie_table_yes()}</strong></td>
					</tr>
				</tbody>
			</table>

			<h2>4. {m.cookie_policy_thirdparty_title()}</h2>

			<h2>{m.cookie_policy_paypal_title()}</h2>
			<p>{m.cookie_policy_paypal_desc()}</p>

			<table>
				<thead>
					<tr>
						<th>{m.cookie_table_name()}</th>
						<th>{m.cookie_table_purpose()}</th>
						<th>{m.cookie_table_duration()}</th>
						<th>{m.cookie_table_consent()}</th>
					</tr>
				</thead>
				<tbody>
					<tr>
						<td>PayPal cookies</td>
						<td>{m.cookie_paypal_purpose()}</td>
						<td>{m.cookie_table_session()}</td>
						<td>{m.cookie_table_implicit()}</td>
					</tr>
				</tbody>
			</table>

			<p>
				<a href="https://www.paypal.com/it/legalhub/privacy-full" target="_blank" rel="noopener">Privacy e Cookie Policy di PayPal</a>
			</p>

			<h2>{m.cookie_policy_google_title()}</h2>
			<p>{m.cookie_policy_google_desc()}</p>
			<p>
				<a href="https://policies.google.com/privacy" target="_blank" rel="noopener">Privacy Policy di Google</a>
			</p>

			<h2>5. {m.cookie_policy_manage_title()}</h2>
			<p>{m.cookie_policy_manage_text()}</p>

			<button type="button" class="secondary" onclick={() => cookieConsent.reopenBanner()}>
				{m.cookie_policy_manage_button()}
			</button>

			<h2>{m.cookie_policy_browser_title()}</h2>
			<p>{m.cookie_policy_browser_text()}</p>
			<ul>
				<li><a href="https://support.google.com/chrome/answer/95647" target="_blank" rel="noopener">Google Chrome</a></li>
				<li><a href="https://support.mozilla.org/it/kb/protezione-antitracciamento-avanzata-firefox-desktop" target="_blank" rel="noopener">Mozilla Firefox</a></li>
				<li><a href="https://support.apple.com/it-it/guide/safari/sfri11471/mac" target="_blank" rel="noopener">Safari</a></li>
				<li><a href="https://support.microsoft.com/it-it/microsoft-edge/eliminare-i-cookie-in-microsoft-edge-63947406-40ac-c3b8-57b9-2a946a29ae09" target="_blank" rel="noopener">Microsoft Edge</a></li>
			</ul>

			<div class="warning-box">
				<p><strong>Attenzione:</strong> {m.cookie_policy_disable_warning()}</p>
			</div>

			<h2>6. {m.cookie_policy_gdpr_title()}</h2>
			<p>{m.cookie_policy_gdpr_text()}</p>

			<h2>7. {m.cookie_policy_updates_title()}</h2>
			<p>{m.cookie_policy_updates_text()}</p>

			<h2>8. {m.cookie_policy_contact_title()}</h2>
			<p>{m.cookie_policy_contact_text()}</p>
			<ul>
				<li>Email: <a href="mailto:dopolavoro.milano@gmail.com">dopolavoro.milano@gmail.com</a></li>
			</ul>
		</TextContainer>
	</div>
</PublicPageLayout>

<style>
	@reference "tailwindcss";

	.legal-page {
		@apply min-h-screen;
	}
</style>
