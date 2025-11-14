import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import LoginPage from './+page.svelte';

describe('Login Page', () => {
	it('renders login heading', () => {
		render(LoginPage);
		expect(screen.getByRole('heading', { name: 'Accedi' })).toBeInTheDocument();
	});

	it('renders email input field', () => {
		render(LoginPage);
		expect(screen.getByLabelText('Email')).toBeInTheDocument();
	});

	it('renders submit button', () => {
		render(LoginPage);
		expect(screen.getByRole('button', { name: /Invia link di accesso/i })).toBeInTheDocument();
	});

	it('renders link to home page', () => {
		render(LoginPage);
		const homeLink = screen.getByRole('link', { name: /Torna alla home/i });
		expect(homeLink).toBeInTheDocument();
		expect(homeLink).toHaveAttribute('href', '/');
	});

	it('shows success message when form is submitted successfully', () => {
		render(LoginPage, {
			props: {
				form: {
					success: true,
					email: 'test@example.com'
				}
			}
		});

		expect(screen.getByText(/Email inviata!/i)).toBeInTheDocument();
		expect(screen.getByText(/test@example.com/)).toBeInTheDocument();
	});

	it('shows error message when email validation fails', () => {
		render(LoginPage, {
			props: {
				form: {
					errors: {
						email: 'Email non valida'
					},
					email: 'invalid'
				}
			}
		});

		expect(screen.getByText('Email non valida')).toBeInTheDocument();
	});

	it('pre-fills email field with previous value on error', () => {
		render(LoginPage, {
			props: {
				form: {
					errors: {
						email: 'Errore'
					},
					email: 'test@example.com'
				}
			}
		});

		const emailInput = screen.getByLabelText('Email') as HTMLInputElement;
		expect(emailInput.value).toBe('test@example.com');
	});
});
