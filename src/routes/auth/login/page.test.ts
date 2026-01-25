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
		const emailInputs = screen.getAllByPlaceholderText(/email/i);
		expect(emailInputs.length).toBeGreaterThan(0);
		expect(emailInputs[0]).toHaveAttribute('type', 'email');
	});

	it('renders submit button', () => {
		render(LoginPage);
		const buttons = screen.getAllByRole('button', { name: /Invia link di accesso/i });
		expect(buttons.length).toBeGreaterThan(0);
	});

	it('renders link to home page', () => {
		render(LoginPage);
		const homeLinks = screen.getAllByRole('link', { name: /Torna alla home/i });
		expect(homeLinks.length).toBeGreaterThan(0);
		expect(homeLinks[0]).toHaveAttribute('href', '/');
	});

	it('shows success message when form is submitted successfully', () => {
		render(LoginPage, {
			form: {
				success: true,
				email: 'test@example.com'
			}
		});

		expect(screen.getByText(/Email inviata!/i)).toBeInTheDocument();
		const emailElements = screen.getAllByText(/test@example.com/);
		expect(emailElements.length).toBeGreaterThan(0);
	});

	it('shows error message when email validation fails', () => {
		render(LoginPage, {
			form: {
				errors: {
					email: 'Email non valida'
				},
				email: 'invalid'
			}
		});

		expect(screen.getByText('Email non valida')).toBeInTheDocument();
	});

	it('shows email input with error state', () => {
		render(LoginPage, {
			form: {
				errors: {
					email: 'Errore'
				},
				email: 'test@example.com'
			}
		});

		// Verify error message is displayed
		expect(screen.getByText('Errore')).toBeInTheDocument();

		// Verify email input exists
		const emailInputs = screen.getAllByPlaceholderText(/email/i);
		expect(emailInputs.length).toBeGreaterThan(0);
		expect(emailInputs[0]).toHaveAttribute('name', 'email');
	});
});
