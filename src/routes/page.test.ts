import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import HomePage from './+page.svelte';

describe('Home Page', () => {
	it('renders without crashing', () => {
		render(HomePage);
		expect(document.body).toBeInTheDocument();
	});

	it('renders logo with correct alt text', () => {
		render(HomePage);
		// Use getAllByAltText since logo might appear in layout too
		const logos = screen.getAllByAltText('Dopo? Space');
		expect(logos.length).toBeGreaterThan(0);
		expect(logos[0]).toBeInTheDocument();
	});

	it('logo is displayed as an image element', () => {
		render(HomePage);
		// Use getAllByRole since logo might appear multiple times
		const logos = screen.getAllByRole('img', { name: 'Dopo? Space' });
		expect(logos.length).toBeGreaterThan(0);
		expect(logos[0]).toBeInTheDocument();
		expect(logos[0].tagName).toBe('IMG');
	});
});
