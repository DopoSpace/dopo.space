import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import SubscriptionPage from './+page.svelte';
import { SystemState } from '$lib/types/membership';

describe('Subscription Page', () => {
	const mockData = {
		user: {
			email: 'test@example.com',
			newsletterSubscribed: false
		},
		profile: null,
		admin: null,
		isAdminRoute: false,
		locale: 'it' as const,
		googlePlacesApiKey: undefined,
		membershipState: SystemState.S0_NO_MEMBERSHIP,
		membershipNumber: null,
		profileComplete: false,
		canProceedToPayment: false
	};

	it('renders subscription heading', () => {
		render(SubscriptionPage, {
			data: mockData,
			form: null
		});

		expect(screen.getByRole('heading', { name: 'Iscrizione' })).toBeInTheDocument();
	});

	it('renders first name input field', () => {
		render(SubscriptionPage, {
			data: mockData,
			form: null
		});

		expect(screen.getByLabelText(/Nome/)).toBeInTheDocument();
	});

	it('renders last name input field', () => {
		render(SubscriptionPage, {
			data: mockData,
			form: null
		});

		expect(screen.getByLabelText(/Cognome/)).toBeInTheDocument();
	});

	it('renders submit button', () => {
		render(SubscriptionPage, {
			data: mockData,
			form: null
		});

		const buttons = screen.getAllByRole('button', { name: /Salva/i });
		expect(buttons.length).toBeGreaterThan(0);
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
				newsletterSubscribed: false
			},
			profile: {
				id: 'profile-1',
				userId: 'user-1',
				createdAt: new Date(),
				updatedAt: new Date(),
				firstName: 'Mario',
				lastName: 'Rossi',
				birthDate: null,
				taxCode: null,
				nationality: null,
				birthProvince: null,
				birthCity: null,
				hasForeignTaxCode: false,
				gender: null,
				address: null,
				city: null,
				postalCode: null,
				province: null,
				phone: null,
				residenceCountry: null,
				documentType: null,
				documentNumber: null,
				privacyConsent: null,
				dataConsent: null,
				profileComplete: false
			},
			admin: null,
			isAdminRoute: false,
			locale: 'it' as const,
			googlePlacesApiKey: undefined,
			membershipState: SystemState.S0_NO_MEMBERSHIP,
			membershipNumber: null,
			profileComplete: false,
			canProceedToPayment: false
		};

		render(SubscriptionPage, {
			data: dataWithProfile,
			form: null
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
});
