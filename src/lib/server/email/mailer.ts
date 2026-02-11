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
			subject: 'Entra in Dopo.space',
			greeting: 'Ciao,',
			clickLink: 'per loggarti su Dopo.space usa questo link qui sotto:',
			button: 'Accedi',
			orCopy: 'Oppure copia e incolla questo link nel tuo browser:',
			expires: 'Il link scadrà tra 30 minuti.'
		},
		payment: {
			subject: 'Conferma Pagamento - Tessera Dopo Space',
			title: 'Pagamento Confermato!',
			greeting: (name: string) => `Ciao ${name},`,
			text: (amount: string) => `Il tuo pagamento di €${amount} è stato elaborato con successo.`,
			cardNote:
				"Grazie per aver completato l'iscrizione! Ti assegneremo a breve un numero di tessera e riceverai la tua tessera digitale da AICS.",
			thanks: 'Grazie per esserti unito a Dopo Space!'
		}
	},
	en: {
		magicLink: {
			subject: 'Enter Dopo.space',
			greeting: 'Hi,',
			clickLink: 'to log in to Dopo.space use the link below:',
			button: 'Login',
			orCopy: 'Or copy and paste this link into your browser:',
			expires: 'This link will expire in 30 minutes.'
		},
		payment: {
			subject: 'Payment Confirmation - Dopo Space Membership',
			title: 'Payment Confirmed!',
			greeting: (name: string) => `Hi ${name},`,
			text: (amount: string) =>
				`Your payment of €${amount} has been successfully processed.`,
			cardNote:
				'Thank you for completing your registration! We will assign you a membership number shortly and you will receive your digital card from AICS.',
			thanks: 'Thank you for joining Dopo Space!'
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

function getLogoSignature(): string {
	if (NODE_ENV !== 'production') return '';

	return `
		<hr style="margin: 24px 0; border: none; border-top: 1px solid #e5e5e5;">
		<a href="https://dopo.space" style="display: inline-block;">
			<img src="https://dopo.space/logo-rosso.png" alt="Dopo" style="height: 32px;" />
		</a>
	`;
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
				<a href="${magicLinkHtml}" style="display: inline-block; padding: 12px 24px; background-color: #DC2626; color: white; text-decoration: none; border-radius: 8px;">${t.button}</a>
				<p>${t.orCopy}</p>
				<p style="word-break: break-all;">${magicLinkHtml}</p>
				<p>${t.expires}</p>
				${getLogoSignature()}
			`,
			text: `${t.greeting}\n\n${t.clickLink}\n\n${magicLink}\n\n${t.expires}`
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
				<h1>${t.title}</h1>
				<p>${t.greeting(firstName)}</p>
				<p>${t.text(formattedAmount)}</p>
				<p>${t.cardNote}</p>
				<br>
				<p>${t.thanks}</p>
			`,
			text: `${t.title}\n\n${t.greeting(firstName)}\n\n${t.text(formattedAmount)}\n\n${t.cardNote}\n\n${t.thanks}`
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
