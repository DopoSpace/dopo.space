import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import AboutPage from './+page.svelte';

describe('About Page', () => {
	it('renders without crashing', () => {
		render(AboutPage);
		expect(document.body).toBeInTheDocument();
	});

	it('displays first paragraph about DOPO cultural center', () => {
		render(AboutPage);
		const paragraphs = screen.getAllByText(/DOPO\? è un centro culturale dove lavorare/);
		expect(paragraphs.length).toBeGreaterThan(0);
	});

	it('displays second paragraph about the concept', () => {
		render(AboutPage);
		const paragraphs = screen.getAllByText(/Il concept di "DOPO\?" si riferisce esplicitamente/);
		expect(paragraphs.length).toBeGreaterThan(0);
	});

	it('displays team paragraph', () => {
		render(AboutPage);
		const paragraphs = screen.getAllByText(/TEAM: Il concept di DOPO\? nasce dalla collaborazione/);
		expect(paragraphs.length).toBeGreaterThan(0);
	});

	it('includes transparency data link', () => {
		render(AboutPage);
		const pdfLinks = screen.getAllByRole('link', { name: /TRASPARENZA DATI/i });
		expect(pdfLinks.length).toBeGreaterThan(0);
	});

	it('PDF link has correct href', () => {
		render(AboutPage);
		const pdfLinks = screen.getAllByRole('link', { name: /TRASPARENZA DATI/i });
		expect(pdfLinks[0]).toHaveAttribute('href', '/dopo_space_trasparenza_dati.pdf');
	});

	it('PDF link opens in new tab', () => {
		render(AboutPage);
		const pdfLinks = screen.getAllByRole('link', { name: /TRASPARENZA DATI/i });
		expect(pdfLinks[0]).toHaveAttribute('target', '_blank');
	});

	it('PDF link is styled as a link', () => {
		render(AboutPage);
		const pdfLinks = screen.getAllByRole('link', { name: /TRASPARENZA DATI/i });
		// Link styling (underline) is applied via TextContainer :global(a) CSS rule
		expect(pdfLinks[0]).toBeInTheDocument();
		expect(pdfLinks[0].tagName.toLowerCase()).toBe('a');
	});
});
