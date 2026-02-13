/**
 * Email Service
 *
 * Handles sending transactional emails via Resend.
 * Supports i18n with locale parameter (Italian/English).
 */

import { Resend } from 'resend';
import { env } from '$lib/server/config/env';
import { NODE_ENV } from '$env/static/private';
import { createLogger } from '$lib/server/utils/logger';

type EmailLocale = 'it' | 'en';

const logger = createLogger({ module: 'mailer' });

const emailTranslations = {
	it: {
		magicLink: {
			subject: 'Il tuo link di accesso a Dopo Space',
			greeting: 'Ciao,',
			clickLink:
				'hai richiesto di accedere alla tua area personale su Dopo Space. Clicca il pulsante qui sotto per entrare:',
			button: 'Accedi a Dopo Space',
			orCopy: 'Se il pulsante non funziona, copia e incolla questo link nel tuo browser:',
			expires: 'Per sicurezza, il link scadrà tra 30 minuti.',
			why: 'Ricevi questa email perché è stato richiesto un accesso con il tuo indirizzo email su dopo.space. Se non sei stato tu, puoi ignorare questo messaggio.'
		},
		payment: {
			subject: 'Dopo Space - Pagamento ricevuto per la tua tessera',
			title: 'Pagamento confermato',
			greeting: (name: string) => `Ciao ${name},`,
			text: (amount: string) =>
				`abbiamo ricevuto il tuo pagamento di €${amount} per la tessera associativa Dopo Space.`,
			cardNote:
				"Ti assegneremo a breve il numero di tessera e riceverai la tua tessera digitale da AICS.",
			thanks: 'Grazie per far parte di Dopo Space, a presto!'
		},
		footer: {
			association:
				'Dopo Space APS — Via Carlo Boncompagni 51/10, 20139 Milano MI',
			why: 'Ricevi questa email perché sei iscritto a Dopo Space.',
			contact: 'Per qualsiasi domanda scrivici a ciao@dopo.space'
		}
	},
	en: {
		magicLink: {
			subject: 'Your Dopo Space login link',
			greeting: 'Hi,',
			clickLink:
				'you requested to access your personal area on Dopo Space. Click the button below to log in:',
			button: 'Log in to Dopo Space',
			orCopy: "If the button doesn't work, copy and paste this link into your browser:",
			expires: 'For security, this link will expire in 30 minutes.',
			why: 'You received this email because a login was requested with your email address on dopo.space. If this was not you, you can safely ignore this message.'
		},
		payment: {
			subject: 'Dopo Space - Payment received for your membership',
			title: 'Payment confirmed',
			greeting: (name: string) => `Hi ${name},`,
			text: (amount: string) =>
				`we received your payment of €${amount} for the Dopo Space membership card.`,
			cardNote:
				'We will assign your membership number shortly and you will receive your digital card from AICS.',
			thanks: 'Thank you for being part of Dopo Space, see you soon!'
		},
		footer: {
			association:
				'Dopo Space APS — Via Carlo Boncompagni 51/10, 20139 Milano MI',
			why: 'You received this email because you are a Dopo Space member.',
			contact: 'For any questions, write to us at ciao@dopo.space'
		}
	}
};

/**
 * Custom error class for email operations with error categorization
 */
export class EmailError extends Error {
	public readonly isTransient: boolean;
	public readonly cause?: unknown;

	constructor(message: string, isTransient: boolean, cause?: unknown) {
		super(message);
		this.name = 'EmailError';
		this.isTransient = isTransient;
		this.cause = cause;
	}
}

function escapeHtml(str: string): string {
	return str
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
}

function isTransientError(error: unknown): boolean {
	if (!(error instanceof Error)) return false;

	const msg = error.message.toLowerCase();

	const transientPatterns = [
		'rate limit',
		'too many requests',
		'service unavailable',
		'timeout',
		'temporarily',
		'try again',
		'network',
		'connection'
	];

	if (transientPatterns.some((pattern) => msg.includes(pattern))) return true;
	if (/\b429\b/.test(msg)) return true;
	if (/\b5\d{2}\b/.test(msg)) return true;

	return false;
}

let resendClient: Resend | null = null;

function getResendClient(): Resend {
	resendClient ??= new Resend(env.RESEND_API_KEY);
	return resendClient;
}

interface EmailOptions {
	to: string;
	subject: string;
	html: string;
	text: string;
}

async function sendWithErrorHandling(
	options: EmailOptions,
	errorMessage: string,
	logContext: Record<string, unknown>
): Promise<void> {
	const resend = getResendClient();

	try {
		const { error } = await resend.emails.send({
			from: env.EMAIL_FROM,
			replyTo: env.EMAIL_FROM,
			...options
		});

		if (error) {
			throw new Error(error.message);
		}
	} catch (error) {
		const transient = isTransientError(error);
		logger.error(
			{ err: error, ...logContext, isTransient: transient },
			`${errorMessage} (${transient ? 'transient' : 'permanent'})`
		);
		throw new EmailError(errorMessage, transient, error);
	}
}

function getEmailFooter(locale: EmailLocale): string {
	const t = emailTranslations[locale].footer;

	const logo =
		NODE_ENV === 'production'
			? `<a href="https://dopo.space" style="display: inline-block;">
				<img src="https://dopo.space/logo-rosso.png" alt="Dopo Space" style="height: 32px;" />
			</a><br><br>`
			: '';

	return `
		<div style="margin-top: 32px; padding-top: 16px; border-top: 1px solid #e5e5e5; font-size: 12px; color: #888888; line-height: 1.5;">
			${logo}
			${t.association}<br>
			${t.contact}<br><br>
			<em>${t.why}</em>
		</div>
	`;
}

function getEmailFooterText(locale: EmailLocale): string {
	const t = emailTranslations[locale].footer;
	return `\n---\n${t.association}\n${t.contact}\n${t.why}`;
}

/**
 * Send magic link email for authentication
 * @throws EmailError with isTransient flag indicating if retry is appropriate
 */
export async function sendMagicLinkEmail(
	email: string,
	token: string,
	url: string,
	locale: EmailLocale = 'it'
): Promise<void> {
	const t = emailTranslations[locale].magicLink;
	const magicLink = `${url}/auth/verify?token=${encodeURIComponent(token)}`;
	const magicLinkHtml = escapeHtml(magicLink);

	await sendWithErrorHandling(
		{
			to: email,
			subject: t.subject,
			html: `
				<p>${t.greeting}</p>
				<p>${t.clickLink}</p>
				<p style="margin: 24px 0;">
					<a href="${magicLinkHtml}" style="display: inline-block; padding: 12px 24px; background-color: #DC2626; color: white; text-decoration: none; border-radius: 8px;">${t.button}</a>
				</p>
				<p style="font-size: 13px; color: #666666;">${t.orCopy}</p>
				<p style="word-break: break-all; font-size: 13px; color: #666666;">${magicLinkHtml}</p>
				<p>${t.expires}</p>
				<p style="font-size: 12px; color: #999999; margin-top: 24px;">${t.why}</p>
				${getEmailFooter(locale)}
			`,
			text: `${t.greeting}\n\n${t.clickLink}\n\n${magicLink}\n\n${t.expires}\n\n${t.why}${getEmailFooterText(locale)}`
		},
		'Failed to send magic link email',
		{ email }
	);
}

/**
 * Send payment confirmation email (S4 state)
 * @throws EmailError with isTransient flag indicating if retry is appropriate
 */
export async function sendPaymentConfirmationEmail(
	email: string,
	firstName: string,
	amount: number,
	locale: EmailLocale = 'it'
): Promise<void> {
	const t = emailTranslations[locale].payment;
	const formattedAmount = (amount / 100).toFixed(2);

	await sendWithErrorHandling(
		{
			to: email,
			subject: t.subject,
			html: `
				<h2 style="color: #333333;">${t.title}</h2>
				<p>${t.greeting(firstName)}</p>
				<p>${t.text(formattedAmount)}</p>
				<p>${t.cardNote}</p>
				<p style="margin-top: 24px;">${t.thanks}</p>
				${getEmailFooter(locale)}
			`,
			text: `${t.title}\n\n${t.greeting(firstName)}\n\n${t.text(formattedAmount)}\n\n${t.cardNote}\n\n${t.thanks}${getEmailFooterText(locale)}`
		},
		'Failed to send payment confirmation email',
		{ email }
	);
}

/**
 * Generic email sending utility
 * @throws EmailError with isTransient flag indicating if retry is appropriate
 */
export async function sendEmail(
	to: string,
	subject: string,
	html: string,
	text?: string
): Promise<void> {
	await sendWithErrorHandling(
		{
			to,
			subject,
			html,
			text: text ?? html.replace(/<[^>]*>/g, '')
		},
		'Failed to send email',
		{ to, subject }
	);
}
