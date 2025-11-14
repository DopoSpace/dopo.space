import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import VerifyPage from './+page.svelte';

describe('Verify Page', () => {
	it('shows loading state when no error', () => {
		render(VerifyPage, {
			props: {
				data: {}
			}
		});

		expect(screen.getByText(/Verifica in corso/i)).toBeInTheDocument();
	});

	it('shows error message when verification fails', () => {
		const errorMessage = 'Link non valido o scaduto';

		render(VerifyPage, {
			props: {
				data: {
					error: errorMessage
				}
			}
		});

		expect(screen.getByText('Errore')).toBeInTheDocument();
		expect(screen.getByText(errorMessage)).toBeInTheDocument();
	});

	it('shows link to request new magic link on error', () => {
		render(VerifyPage, {
			props: {
				data: {
					error: 'Token expired'
				}
			}
		});

		const link = screen.getByRole('link', { name: /Richiedi nuovo link/i });
		expect(link).toBeInTheDocument();
		expect(link).toHaveAttribute('href', '/auth/login');
	});

	it('applies error styling when error is present', () => {
		render(VerifyPage, {
			props: {
				data: {
					error: 'Test error'
				}
			}
		});

		const errorHeading = screen.getByRole('heading', { name: 'Errore' });
		expect(errorHeading).toHaveClass('text-red-600');
	});
});
