import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import { writable } from 'svelte/store';
import MenuItem from './MenuItem.svelte';

// Mock $app/stores
vi.mock('$app/stores', () => {
	const page = writable({
		url: new URL('http://localhost/'),
		params: {},
		route: { id: '/' },
		status: 200,
		error: null,
		data: {},
		form: null
	});

	return { page };
});

describe('MenuItem Component', () => {
	beforeEach(async () => {
		const { page } = await import('$app/stores');
		// Reset to home page before each test
		page.set({
			url: new URL('http://localhost/'),
			params: {},
			route: { id: '/' },
			status: 200,
			error: null,
			data: {},
			form: null
		});
	});

	it('renders link with correct text', () => {
		render(MenuItem, { to: '/about', item: 'About' });
		const link = screen.getByText('About');
		expect(link).toBeInTheDocument();
	});

	it('renders link with correct href', () => {
		render(MenuItem, { to: '/contact', item: 'Contact' });
		const links = screen.getAllByRole('link', { name: 'Contact' });
		const contactLink = links.find(link => link.getAttribute('href') === '/contact');
		expect(contactLink).toHaveAttribute('href', '/contact');
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
		const links = screen.getAllByRole('link', { name: 'About' });
		const aboutLink = links.find(link => link.getAttribute('href') === '/about');
		expect(aboutLink).toHaveClass('underline');
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
		const links = screen.getAllByRole('link', { name: 'About' });
		const aboutLink = links.find(link => link.getAttribute('href') === '/about');
		expect(aboutLink).not.toHaveClass('underline');
	});
});
