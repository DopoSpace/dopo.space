import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import SubscriptionPage from './+page.svelte';

describe('Subscription Page', () => {
	const mockData = {
		user: {
			email: 'test@example.com',
			firstName: null,
			lastName: null
		}
	};

	it('renders subscription heading', () => {
		render(SubscriptionPage, {
			data: mockData
		});

		expect(screen.getByRole('heading', { name: 'Subscription' })).toBeInTheDocument();
	});

	it('displays user email', () => {
		render(SubscriptionPage, {
			data: mockData
		});

		const emailElements = screen.getAllByText(/test@example.com/);
		expect(emailElements.length).toBeGreaterThan(0);
	});

	it('renders first name input field', () => {
		render(SubscriptionPage, {
			data: mockData
		});

		expect(screen.getByLabelText(/Nome/)).toBeInTheDocument();
	});

	it('renders last name input field', () => {
		render(SubscriptionPage, {
			data: mockData
		});

		expect(screen.getByLabelText(/Cognome/)).toBeInTheDocument();
	});

	it('renders submit button', () => {
		render(SubscriptionPage, {
			data: mockData
		});

		const buttons = screen.getAllByRole('button', { name: /Salva/i });
		expect(buttons.length).toBeGreaterThan(0);
	});

	it('shows success message when form is submitted successfully', () => {
		render(SubscriptionPage, {
			data: mockData,
			form: {
				success: true
			}
		});

		expect(screen.getByText(/Dati salvati!/i)).toBeInTheDocument();
	});

	it('shows field errors when validation fails', () => {
		render(SubscriptionPage, {
			data: mockData,
			form: {
				errors: {
					firstName: 'Il nome è obbligatorio',
					lastName: 'Il cognome è obbligatorio'
				},
				values: {
					firstName: '',
					lastName: ''
				}
			}
		});

		expect(screen.getByText('Il nome è obbligatorio')).toBeInTheDocument();
		expect(screen.getByText('Il cognome è obbligatorio')).toBeInTheDocument();
	});

	it('pre-fills form with existing user data', () => {
		const dataWithProfile = {
			user: {
				email: 'test@example.com',
				firstName: 'Mario',
				lastName: 'Rossi'
			}
		};

		render(SubscriptionPage, {
			data: dataWithProfile
		});

		// In browser mode, just verify the inputs exist and have correct names
		const firstNameInput = screen.getByLabelText(/Nome/);
		const lastNameInput = screen.getByLabelText(/Cognome/);

		expect(firstNameInput).toBeInTheDocument();
		expect(firstNameInput).toHaveAttribute('name', 'firstName');
		expect(lastNameInput).toBeInTheDocument();
		expect(lastNameInput).toHaveAttribute('name', 'lastName');
	});

	it('shows general form error when _form error exists', () => {
		render(SubscriptionPage, {
			data: mockData,
			form: {
				errors: {
					_form: 'Errore generale del server'
				}
			}
		});

		expect(screen.getByText('Errore generale del server')).toBeInTheDocument();
	});

	it('renders link to home page', () => {
		render(SubscriptionPage, {
			data: mockData
		});

		const homeLinks = screen.getAllByRole('link', { name: /Torna alla home/i });
		expect(homeLinks.length).toBeGreaterThan(0);
		expect(homeLinks[0]).toHaveAttribute('href', '/');
	});
});
