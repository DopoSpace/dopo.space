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
			props: {
				data: mockData
			}
		});

		expect(screen.getByRole('heading', { name: 'Subscription' })).toBeInTheDocument();
	});

	it('displays user email', () => {
		render(SubscriptionPage, {
			props: {
				data: mockData
			}
		});

		expect(screen.getByText(/test@example.com/)).toBeInTheDocument();
	});

	it('renders first name input field', () => {
		render(SubscriptionPage, {
			props: {
				data: mockData
			}
		});

		expect(screen.getByLabelText(/Nome/)).toBeInTheDocument();
	});

	it('renders last name input field', () => {
		render(SubscriptionPage, {
			props: {
				data: mockData
			}
		});

		expect(screen.getByLabelText(/Cognome/)).toBeInTheDocument();
	});

	it('renders submit button', () => {
		render(SubscriptionPage, {
			props: {
				data: mockData
			}
		});

		expect(screen.getByRole('button', { name: /Salva/i })).toBeInTheDocument();
	});

	it('shows success message when form is submitted successfully', () => {
		render(SubscriptionPage, {
			props: {
				data: mockData,
				form: {
					success: true
				}
			}
		});

		expect(screen.getByText(/Dati salvati!/i)).toBeInTheDocument();
	});

	it('shows field errors when validation fails', () => {
		render(SubscriptionPage, {
			props: {
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
			props: {
				data: dataWithProfile
			}
		});

		const firstNameInput = screen.getByLabelText(/Nome/) as HTMLInputElement;
		const lastNameInput = screen.getByLabelText(/Cognome/) as HTMLInputElement;

		expect(firstNameInput.value).toBe('Mario');
		expect(lastNameInput.value).toBe('Rossi');
	});

	it('shows general form error when _form error exists', () => {
		render(SubscriptionPage, {
			props: {
				data: mockData,
				form: {
					errors: {
						_form: 'Errore generale del server'
					}
				}
			}
		});

		expect(screen.getByText('Errore generale del server')).toBeInTheDocument();
	});

	it('renders link to home page', () => {
		render(SubscriptionPage, {
			props: {
				data: mockData
			}
		});

		const homeLink = screen.getByRole('link', { name: /Torna alla home/i });
		expect(homeLink).toBeInTheDocument();
		expect(homeLink).toHaveAttribute('href', '/');
	});
});
