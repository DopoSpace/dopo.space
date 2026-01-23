<script lang="ts">
	import LegalPageLayout from '$lib/components/LegalPageLayout.svelte';
</script>

<svelte:head>
	<title>Cookie Policy - DOPO? ASD</title>
	<meta name="description" content="Informativa sui cookie di DOPO? ASD" />
</svelte:head>

<LegalPageLayout title="Cookie Policy" lastUpdated="21 Gennaio 2026">
	<h2>1. Cosa sono i Cookie</h2>
	<p>
		I cookie sono piccoli file di testo che vengono memorizzati sul tuo dispositivo (computer, smartphone, tablet) quando visiti un sito web. I cookie permettono al sito di riconoscerti e memorizzare alcune informazioni sulle tue preferenze o azioni precedenti.
	</p>

	<h2>2. Tipologie di Cookie Utilizzati</h2>

	<h3>2.1 Cookie Tecnici (essenziali)</h3>
	<p>
		Questi cookie sono necessari per il funzionamento del sito e non possono essere disattivati. Vengono impostati in risposta ad azioni da te effettuate, come l'impostazione delle preferenze di privacy, l'accesso o la compilazione di moduli.
	</p>
	<table class="cookie-table">
		<thead>
			<tr>
				<th>Nome</th>
				<th>Finalita</th>
				<th>Durata</th>
			</tr>
		</thead>
		<tbody>
			<tr>
				<td><code>session</code></td>
				<td>Gestione della sessione utente autenticato</td>
				<td>Sessione (7 giorni)</td>
			</tr>
			<tr>
				<td><code>admin_session</code></td>
				<td>Gestione della sessione amministratore</td>
				<td>Sessione (7 giorni)</td>
			</tr>
			<tr>
				<td><code>cookie_consent</code></td>
				<td>Memorizza le tue preferenze sui cookie</td>
				<td>1 anno</td>
			</tr>
		</tbody>
	</table>

	<h3>2.2 Cookie di Terze Parti</h3>

	<h4>PayPal</h4>
	<p>
		Quando procedi al pagamento della quota associativa, PayPal potrebbe impostare cookie per garantire la sicurezza della transazione e prevenire frodi.
	</p>
	<p>
		<a href="https://www.paypal.com/it/legalhub/privacy-full" target="_blank" rel="noopener">Privacy e Cookie Policy di PayPal</a>
	</p>

	<h4>Google Places API</h4>
	<p>
		Utilizziamo Google Places API per l'autocompletamento degli indirizzi nel modulo di registrazione. Google potrebbe impostare cookie tecnici per il funzionamento del servizio.
	</p>
	<p>
		<a href="https://policies.google.com/privacy" target="_blank" rel="noopener">Privacy Policy di Google</a>
	</p>

	<h2>3. Come Gestire i Cookie</h2>

	<h3>3.1 Tramite il tuo browser</h3>
	<p>
		Puoi gestire le preferenze sui cookie direttamente dal tuo browser. Di seguito i link alle guide dei principali browser:
	</p>
	<ul>
		<li><a href="https://support.google.com/chrome/answer/95647" target="_blank" rel="noopener">Google Chrome</a></li>
		<li><a href="https://support.mozilla.org/it/kb/protezione-antitracciamento-avanzata-firefox-desktop" target="_blank" rel="noopener">Mozilla Firefox</a></li>
		<li><a href="https://support.apple.com/it-it/guide/safari/sfri11471/mac" target="_blank" rel="noopener">Safari</a></li>
		<li><a href="https://support.microsoft.com/it-it/microsoft-edge/eliminare-i-cookie-in-microsoft-edge-63947406-40ac-c3b8-57b9-2a946a29ae09" target="_blank" rel="noopener">Microsoft Edge</a></li>
	</ul>

	<h3>3.2 Conseguenze della disabilitazione</h3>
	<div class="warning-box">
		<p>
			<strong>Attenzione:</strong> La disabilitazione dei cookie tecnici potrebbe compromettere il funzionamento del sito, in particolare le funzionalita di autenticazione e pagamento.
		</p>
	</div>

	<h2>4. Cookie e GDPR</h2>
	<p>
		In conformita con il Regolamento UE 2016/679 (GDPR) e la Direttiva ePrivacy, questo sito:
	</p>
	<ul>
		<li>Utilizza solo cookie tecnici essenziali per il funzionamento</li>
		<li>Non utilizza cookie di profilazione o tracciamento</li>
		<li>Non cede dati raccolti tramite cookie a terze parti per finalita di marketing</li>
	</ul>

	<h2>5. Aggiornamenti alla Cookie Policy</h2>
	<p>
		Questa Cookie Policy potrebbe essere aggiornata periodicamente. Ti invitiamo a consultare questa pagina regolarmente per essere informato su eventuali modifiche. La data dell'ultimo aggiornamento e indicata in cima a questa pagina.
	</p>

	<h2>6. Contatti</h2>
	<p>
		Per qualsiasi domanda relativa all'uso dei cookie su questo sito, puoi contattarci a:
	</p>
	<ul>
		<li>Email: <a href="mailto:privacy@dopo.space">privacy@dopo.space</a></li>
	</ul>
</LegalPageLayout>

<style>
	@reference "tailwindcss";

	:global(.cookie-table) {
		@apply w-full border-collapse my-6;
	}

	:global(.cookie-table th),
	:global(.cookie-table td) {
		@apply border border-gray-200 px-4 py-2 text-left;
	}

	:global(.cookie-table th) {
		@apply bg-gray-50 font-semibold text-gray-900;
	}

	:global(.cookie-table code) {
		@apply bg-gray-100 px-2 py-0.5 rounded text-sm font-mono;
	}
</style>
