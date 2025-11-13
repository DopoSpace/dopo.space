import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import MenuItem from './MenuItem.svelte';

describe('MenuItem Component', () => {
	it('renders link with correct text', () => {
		render(MenuItem, { to: '/about', item: 'About' });
		const link = screen.getByText('About');
		expect(link).toBeInTheDocument();
	});

	it('renders link with correct href', () => {
		render(MenuItem, { to: '/contact', item: 'Contact' });
		const link = screen.getByRole('link', { name: 'Contact' });
		expect(link).toHaveAttribute('href', '/contact');
	});

	it('applies underline class when active', async () => {
		const { page } = await import('$app/stores');

		// Set the current page to match the link
		page.set({
			url: new URL('http://localhost/about'),
			params: {},
			route: { id: '/about' },
			status: 200,
			error: null,
			data: {},
			form: null
		});

		render(MenuItem, { to: '/about', item: 'About' });
		const link = screen.getByRole('link', { name: 'About' });
		expect(link).toHaveClass('underline');
	});

	it('does not apply underline class when inactive', async () => {
		const { page } = await import('$app/stores');

		// Set the current page to a different route
		page.set({
			url: new URL('http://localhost/'),
			params: {},
			route: { id: '/' },
			status: 200,
			error: null,
			data: {},
			form: null
		});

		render(MenuItem, { to: '/about', item: 'About' });
		const link = screen.getByRole('link', { name: 'About' });
		expect(link).not.toHaveClass('underline');
	});
});
