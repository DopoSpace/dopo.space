import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import ContactPage from './+page.svelte';

describe('Contact Page', () => {
	it('renders without crashing', () => {
		render(ContactPage);
		expect(document.body).toBeInTheDocument();
	});

	it('displays email label', () => {
		render(ContactPage);
		const emailLabels = screen.getAllByText(/email:/i);
		expect(emailLabels.length).toBeGreaterThan(0);
	});

	it('includes email link with correct attributes', () => {
		render(ContactPage);
		const links = screen.getAllByRole('link', { name: /dopolavoro\.milano@gmail\.com/i });
		expect(links.length).toBeGreaterThan(0);
		expect(links[0]).toHaveAttribute('href', 'mailto:dopolavoro.milano@gmail.com');
		expect(links[0]).toHaveAttribute('target', '_blank');
		// Underline styling is applied via TextContainer :global(a) CSS rule
	});

	it('displays Instagram label', () => {
		render(ContactPage);
		const igLabels = screen.getAllByText(/ig:/i);
		expect(igLabels.length).toBeGreaterThan(0);
	});

	it('includes Instagram link with correct attributes', () => {
		render(ContactPage);
		const links = screen.getAllByRole('link', { name: /dopo\.space/i });
		expect(links.length).toBeGreaterThan(0);
		expect(links[0]).toHaveAttribute('href', 'https://www.instagram.com/dopo.space/');
		expect(links[0]).toHaveAttribute('target', '_blank');
		// Underline styling is applied via TextContainer :global(a) CSS rule
	});

	it('displays location label', () => {
		render(ContactPage);
		const locationLabels = screen.getAllByText(/sede:/i);
		expect(locationLabels.length).toBeGreaterThan(0);
	});

	it('includes location link with correct attributes', () => {
		render(ContactPage);
		const links = screen.getAllByRole('link', { name: /Via Boncompagni 51\/10, Milano/i });
		expect(links.length).toBeGreaterThan(0);
		expect(links[0]).toHaveAttribute('href', 'https://www.google.com/maps/place/DOPO%3F/@45.4385079,9.2315244,17z/');
		expect(links[0]).toHaveAttribute('target', '_blank');
		// Underline styling is applied via TextContainer :global(a) CSS rule
	});
});
