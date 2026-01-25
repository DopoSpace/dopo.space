import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import Menu from './Menu.svelte';

// Create a simple writable store implementation for vi.hoisted
const { mockPage } = vi.hoisted(() => {
	// Simple writable store implementation that works without imports
	function createWritable<T>(initial: T) {
		let value = initial;
		const subscribers = new Set<(value: T) => void>();
		return {
			subscribe(fn: (value: T) => void) {
				subscribers.add(fn);
				fn(value);
				return () => subscribers.delete(fn);
			},
			set(newValue: T) {
				value = newValue;
				subscribers.forEach(fn => fn(value));
			}
		};
	}
	return {
		mockPage: createWritable({
			url: new URL('http://localhost/'),
			params: {},
			route: { id: '/' },
			status: 200,
			error: null,
			data: {},
			form: null,
			state: {}
		})
	};
});

// Mock $app/stores
vi.mock('$app/stores', () => ({
	page: mockPage
}));

describe('Menu Component', () => {

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

	it('has menu class for navigation container', () => {
		const { container } = render(Menu);
		// Menu uses .menu class with CSS @apply for positioning and background
		const menuNav = container.querySelector('nav.menu');
		expect(menuNav).toBeInTheDocument();
	});

	it('has menu-container class for flex layout', () => {
		const { container } = render(Menu);
		// Menu uses .menu-container class with CSS @apply for flex layout
		const menuContainer = container.querySelector('.menu-container');
		expect(menuContainer).toBeInTheDocument();
	});
});
