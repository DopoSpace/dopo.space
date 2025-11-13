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
		const logo = screen.getByAltText('Dopo? Space');
		expect(logo).toBeInTheDocument();
	});

	it('logo is displayed as an image element', () => {
		render(HomePage);
		const logo = screen.getByRole('img', { name: 'Dopo? Space' });
		expect(logo).toBeInTheDocument();
		expect(logo.tagName).toBe('IMG');
	});
});
