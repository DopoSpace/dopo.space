import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import ContactPage from './+page.svelte';
import { testExternalLink } from '$lib/test-utils/pageTestHelpers';

describe('Contact Page', () => {
	it('renders without crashing', () => {
		render(ContactPage);
		expect(document.body).toBeInTheDocument();
	});

	it('displays email label', () => {
		render(ContactPage);
		expect(screen.getByText(/email:/i)).toBeInTheDocument();
	});

	it('includes email link with correct attributes', () => {
		render(ContactPage);
		testExternalLink(/dopolavoro\.milano@gmail\.com/i, 'mailto:dopolavoro.milano@gmail.com');
	});

	it('displays Instagram label', () => {
		render(ContactPage);
		expect(screen.getByText(/ig:/i)).toBeInTheDocument();
	});

	it('includes Instagram link with correct attributes', () => {
		render(ContactPage);
		testExternalLink(/dopo\.space/i, 'https://www.instagram.com/dopo.space/');
	});

	it('displays location label', () => {
		render(ContactPage);
		expect(screen.getByText(/sede:/i)).toBeInTheDocument();
	});

	it('includes location link with correct attributes', () => {
		render(ContactPage);
		testExternalLink(
			/Via Boncompagni 51\/10, Milano/i,
			'https://www.google.com/maps/place/DOPO%3F/@45.4385079,9.2315244,17z/'
		);
	});
});
