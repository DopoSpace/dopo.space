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
		expect(
			screen.getByText(/DOPO\? è un centro culturale dove lavorare/i)
		).toBeInTheDocument();
	});

	it('displays second paragraph about the concept', () => {
		render(AboutPage);
		expect(
			screen.getByText(/Il concept di "DOPO\?" si riferisce esplicitamente/i)
		).toBeInTheDocument();
	});

	it('displays team paragraph', () => {
		render(AboutPage);
		expect(
			screen.getByText(/TEAM: Il concept di DOPO\? nasce dalla collaborazione/i)
		).toBeInTheDocument();
	});

	it('includes transparency data link', () => {
		render(AboutPage);
		const pdfLink = screen.getByRole('link', { name: 'TRASPARENZA DATI' });
		expect(pdfLink).toBeInTheDocument();
	});

	it('PDF link has correct href', () => {
		render(AboutPage);
		const pdfLink = screen.getByRole('link', { name: 'TRASPARENZA DATI' });
		expect(pdfLink).toHaveAttribute('href', '/dopo_space_trasparenza_dati.pdf');
	});

	it('PDF link opens in new tab', () => {
		render(AboutPage);
		const pdfLink = screen.getByRole('link', { name: 'TRASPARENZA DATI' });
		expect(pdfLink).toHaveAttribute('target', '_blank');
	});

	it('PDF link is underlined', () => {
		render(AboutPage);
		const pdfLink = screen.getByRole('link', { name: 'TRASPARENZA DATI' });
		expect(pdfLink).toHaveClass('underline');
	});
});
