import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import VerifyPage from './+page.svelte';

// Base mock data that satisfies the PageData type from root layout
const baseMockData = {
	admin: null,
	user: null,
	isAdminRoute: false
};

describe('Verify Page', () => {
	it('shows loading state when no error', () => {
		render(VerifyPage, {
			data: {
				...baseMockData,
				error: ''
			}
		});

		expect(screen.getByText(/Verifica in corso/i)).toBeInTheDocument();
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
		expect(screen.getByText(errorMessage)).toBeInTheDocument();
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

	it('applies error styling when error is present', () => {
		render(VerifyPage, {
			data: {
				...baseMockData,
				error: 'Test error'
			}
		});

		const errorHeadings = screen.getAllByRole('heading', { name: 'Errore' });
		expect(errorHeadings.length).toBeGreaterThan(0);
		expect(errorHeadings[0]).toHaveClass('text-red-600');
	});
});
