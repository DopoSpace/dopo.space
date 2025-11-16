import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import { writable } from 'svelte/store';
import Menu from './Menu.svelte';
import { testElementClasses } from '$lib/test-utils/pageTestHelpers';

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

describe('Menu Component', () => {
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

	it('renders all three navigation links', () => {
		render(Menu);

		const homeLinks = screen.getAllByRole('link', { name: 'Home' });
		const aboutLinks = screen.getAllByRole('link', { name: 'About' });
		const contactLinks = screen.getAllByRole('link', { name: 'Contact' });

		expect(homeLinks.length).toBeGreaterThan(0);
		expect(aboutLinks.length).toBeGreaterThan(0);
		expect(contactLinks.length).toBeGreaterThan(0);
	});

	it('has correct href attributes', () => {
		render(Menu);

		const homeLinks = screen.getAllByRole('link', { name: 'Home' });
		const aboutLinks = screen.getAllByRole('link', { name: 'About' });
		const contactLinks = screen.getAllByRole('link', { name: 'Contact' });

		expect(homeLinks[0]).toHaveAttribute('href', '/');
		expect(aboutLinks[0]).toHaveAttribute('href', '/about');
		expect(contactLinks[0]).toHaveAttribute('href', '/contact');
	});

	it('has correct CSS classes for layout', () => {
		const { container } = render(Menu);
		testElementClasses(container, 'div.absolute', [
			'absolute',
			'top-0',
			'left-0',
			'bg-dopoRed',
			'w-full'
		]);
	});

	it('has flex layout with correct gap', () => {
		const { container } = render(Menu);
		testElementClasses(container, 'div.flex', ['flex', 'justify-between', 'items-center', 'gap-4']);
	});
});
