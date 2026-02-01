<script lang="ts">
	import PublicPageLayout from '$lib/components/PublicPageLayout.svelte';
	import TextContainer from '$lib/components/TextContainer.svelte';
	import * as m from '$lib/paraglide/messages';
</script>

<svelte:head>
	<title>Privacy Policy - APS Dopolavoro</title>
	<meta name="description" content="Informativa sulla privacy di APS Dopolavoro ai sensi del GDPR" />
</svelte:head>

<PublicPageLayout>
	<div class="legal-page">
		<TextContainer>
			<h1>Privacy Policy</h1>
			<p style="opacity: 0.7; font-size: 1rem;">{m.cookie_policy_last_updated({ date: '21 Gennaio 2026' })}</p>

			<h2>1. Titolare del Trattamento</h2>
			<p>
				Il Titolare del trattamento dei dati personali e <strong>APS Dopolavoro</strong> (Associazione di Promozione Sociale), con sede legale in Via Boncompagni 51/10, 20139 Milano (MI), Italia. P.IVA 13537230966.
			</p>
			<p>
				Per qualsiasi domanda relativa al trattamento dei tuoi dati personali, puoi contattarci all'indirizzo email: <a href="mailto:dopolavoro.milano@gmail.com">dopolavoro.milano@gmail.com</a>
			</p>

			<h2>2. Dati Personali Raccolti</h2>
			<p>Raccogliamo le seguenti categorie di dati personali:</p>

			<h2>2.1 Dati identificativi</h2>
			<ul>
				<li>Nome e cognome</li>
				<li>Codice fiscale</li>
				<li>Data e luogo di nascita</li>
				<li>Nazionalita</li>
				<li>Sesso (solo per cittadini esteri senza codice fiscale italiano)</li>
			</ul>

			<h2>2.2 Dati di contatto</h2>
			<ul>
				<li>Indirizzo email</li>
				<li>Numero di telefono (opzionale)</li>
				<li>Indirizzo di residenza (via, citta, CAP, provincia, paese)</li>
			</ul>

			<h2>2.3 Dati relativi all'iscrizione</h2>
			<ul>
				<li>Data di iscrizione</li>
				<li>Numero tessera associativa</li>
				<li>Stato della membership</li>
				<li>Storico dei pagamenti</li>
			</ul>

			<h2>3. Finalita del Trattamento e Base Giuridica</h2>

			<h2>3.1 Gestione dell'iscrizione e del tesseramento (base giuridica: esecuzione del contratto)</h2>
			<p>I tuoi dati sono necessari per:</p>
			<ul>
				<li>Creare e gestire la tua tessera associativa</li>
				<li>Verificare i requisiti di iscrizione</li>
				<li>Comunicare informazioni relative alla tua membership</li>
				<li>Processare il pagamento della quota associativa</li>
			</ul>

			<h2>3.2 Adempimenti di legge (base giuridica: obbligo legale)</h2>
			<p>Siamo tenuti a trattare i tuoi dati per:</p>
			<ul>
				<li>Adempiere agli obblighi fiscali e contabili</li>
				<li>Ottemperare alle richieste dell'autorita giudiziaria</li>
				<li>Rispettare la normativa sulle associazioni sportive dilettantistiche</li>
			</ul>

			<h2>3.3 Invio newsletter (base giuridica: consenso)</h2>
			<p>
				Previo tuo specifico consenso, potremmo inviarti comunicazioni promozionali e informative sulle attivita dell'associazione tramite la nostra newsletter.
			</p>

			<h2>4. Destinatari dei Dati</h2>
			<p>I tuoi dati personali potranno essere comunicati a:</p>

			<h2>4.1 Ente di affiliazione sportiva</h2>
			<p>
				<strong>AICS (Associazione Italiana Cultura Sport)</strong> - I tuoi dati sono condivisi con AICS per il tesseramento sportivo, come richiesto dalla normativa sulle ASD.
			</p>

			<h2>4.2 Fornitori di servizi</h2>
			<ul>
				<li>
					<strong>PayPal</strong> - Per il processamento dei pagamenti. PayPal opera come titolare autonomo del trattamento.
					<a href="https://www.paypal.com/it/legalhub/privacy-full" target="_blank" rel="noopener">Privacy Policy PayPal</a>
				</li>
				<li>
					<strong>Mailchimp (Intuit Inc.)</strong> - Per l'invio della newsletter (solo se hai dato il consenso).
					<a href="https://www.intuit.com/privacy/statement/" target="_blank" rel="noopener">Privacy Policy Mailchimp</a>
				</li>
			</ul>

			<h2>4.3 Professionisti e consulenti</h2>
			<p>
				Commercialisti, consulenti fiscali e legali per l'adempimento degli obblighi di legge.
			</p>

			<h2>5. Trasferimento dei Dati Extra-UE</h2>
			<div class="info-box">
				<p>
					<strong>Nota importante:</strong> Alcuni dei nostri fornitori di servizi (PayPal, Mailchimp) hanno sede negli Stati Uniti. Il trasferimento dei dati verso gli USA avviene sulla base delle Standard Contractual Clauses (SCC) approvate dalla Commissione Europea, che garantiscono un livello di protezione adeguato per i tuoi dati personali.
				</p>
			</div>

			<h2>6. Periodo di Conservazione dei Dati</h2>
			<p>Conserviamo i tuoi dati per i seguenti periodi:</p>
			<ul>
				<li><strong>Dati di iscrizione:</strong> Per tutta la durata della membership e per i 10 anni successivi alla sua cessazione (obblighi fiscali)</li>
				<li><strong>Dati contabili e fiscali:</strong> 10 anni dalla data di registrazione</li>
				<li><strong>Dati per newsletter:</strong> Fino alla revoca del consenso</li>
				<li><strong>Dati di navigazione (log):</strong> 6 mesi</li>
			</ul>

			<h2>7. I Tuoi Diritti</h2>
			<p>Ai sensi del GDPR (Regolamento UE 2016/679), hai diritto di:</p>
			<ul>
				<li><strong>Accesso:</strong> Ottenere conferma del trattamento e copia dei tuoi dati</li>
				<li><strong>Rettifica:</strong> Correggere dati inesatti o incompleti</li>
				<li><strong>Cancellazione:</strong> Richiedere la cancellazione dei dati (nei limiti di legge)</li>
				<li><strong>Limitazione:</strong> Limitare il trattamento in determinate circostanze</li>
				<li><strong>Portabilita:</strong> Ricevere i dati in formato strutturato</li>
				<li><strong>Opposizione:</strong> Opporti al trattamento per motivi legittimi</li>
				<li><strong>Revoca del consenso:</strong> Revocare in qualsiasi momento i consensi prestati</li>
			</ul>
			<p>
				Per esercitare i tuoi diritti, puoi contattarci all'indirizzo <a href="mailto:dopolavoro.milano@gmail.com">dopolavoro.milano@gmail.com</a>
			</p>

			<h2>8. Diritto di Reclamo</h2>
			<p>
				Se ritieni che il trattamento dei tuoi dati violi la normativa vigente, hai diritto di proporre reclamo all'autorita di controllo competente:
			</p>
			<p>
				<strong>Garante per la Protezione dei Dati Personali</strong><br>
				Piazza Venezia 11, 00187 Roma<br>
				<a href="https://www.garanteprivacy.it" target="_blank" rel="noopener">www.garanteprivacy.it</a>
			</p>

			<h2>9. Natura del Conferimento dei Dati</h2>
			<p>
				Il conferimento dei dati contrassegnati come obbligatori e necessario per la creazione della tessera associativa. Il mancato conferimento di tali dati comporta l'impossibilita di procedere con l'iscrizione.
			</p>
			<p>
				Il conferimento del numero di telefono e facoltativo e non pregiudica la possibilita di iscriversi.
			</p>
			<p>
				Il consenso alla newsletter e facoltativo e puo essere revocato in qualsiasi momento senza conseguenze sull'iscrizione.
			</p>

			<h2>10. Modifiche alla Privacy Policy</h2>
			<p>
				Ci riserviamo il diritto di modificare questa informativa in qualsiasi momento. Le modifiche saranno pubblicate su questa pagina con indicazione della data di ultimo aggiornamento. Ti invitiamo a consultare periodicamente questa pagina.
			</p>

			<h2>11. Contatti</h2>
			<p>
				Per qualsiasi domanda relativa a questa Privacy Policy o al trattamento dei tuoi dati personali, puoi contattarci a:
			</p>
			<ul>
				<li>Email: <a href="mailto:dopolavoro.milano@gmail.com">dopolavoro.milano@gmail.com</a></li>
				<li>Indirizzo: APS Dopolavoro, Via Boncompagni 51/10, 20139 Milano (MI), Italia</li>
				<li>P.IVA: 13537230966</li>
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
