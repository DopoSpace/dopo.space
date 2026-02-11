import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import VerifyPage from './+page.svelte';

// Base mock data that satisfies the PageData type from root layout
const baseMockData = {
	admin: null,
	user: null,
	isAdminRoute: false,
	locale: 'it' as const
};

describe('Verify Page', () => {
	it('shows loading state when token is present and no error', () => {
		render(VerifyPage, {
			data: {
				...baseMockData,
				token: 'valid-token-here'
			}
		});

		expect(screen.getByText(/Verifica in corso/i)).toBeInTheDocument();
	});

	it('renders hidden form with token for auto-submit', () => {
		render(VerifyPage, {
			data: {
				...baseMockData,
				token: 'test-token-123'
			}
		});

		const form = document.querySelector('form[method="POST"]');
		expect(form).toBeInTheDocument();
		const hiddenInput = form?.querySelector('input[name="token"]') as HTMLInputElement;
		expect(hiddenInput).toBeInTheDocument();
		expect(hiddenInput.value).toBe('test-token-123');
	});

	it('shows error message when verification fails', () => {
		const errorMessage = 'Link non valido o scaduto';

		render(VerifyPage, {
			data: {
				...baseMockData,
				error: errorMessage
			}
		});

		const errorHeadings = screen.getAllByText('Errore');
		expect(errorHeadings.length).toBeGreaterThan(0);
		expect(screen.getByText(new RegExp(errorMessage))).toBeInTheDocument();
	});

	it('shows link to request new magic link on error', () => {
		render(VerifyPage, {
			data: {
				...baseMockData,
				error: 'Token expired'
			}
		});

		const links = screen.getAllByRole('link', { name: /Richiedi nuovo link/i });
		expect(links.length).toBeGreaterThan(0);
		expect(links[0]).toHaveAttribute('href', '/auth/login');
	});

	it('renders error title as h1 heading', () => {
		render(VerifyPage, {
			data: {
				...baseMockData,
				error: 'Test error'
			}
		});

		const errorHeadings = screen.getAllByRole('heading', { name: 'Errore' });
		expect(errorHeadings.length).toBeGreaterThan(0);
		expect(errorHeadings[0].tagName.toLowerCase()).toBe('h1');
	});

	it('shows form error when action returns failure', () => {
		const errorMessage = 'Link non valido o scaduto';

		render(VerifyPage, {
			data: {
				...baseMockData,
				token: 'some-token'
			},
			form: {
				error: errorMessage
			}
		});

		expect(screen.getByText(new RegExp(errorMessage))).toBeInTheDocument();
	});
});
