import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import { writable } from 'svelte/store';
import type { Page } from '@sveltejs/kit';
import MenuItem from './MenuItem.svelte';

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

describe('MenuItem Component', () => {

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

	it('applies underline class when active', () => {
		// Set the current page to match the link
		mockPage.set({
			url: new URL('http://localhost/about'),
			params: {},
			route: { id: '/about' },
			status: 200,
			error: null,
			data: {},
			form: null,
			state: {}
		});

		render(MenuItem, { to: '/about', item: 'About' });
		const links = screen.getAllByRole('link', { name: 'About' });
		const aboutLink = links.find(link => link.getAttribute('href') === '/about');
		expect(aboutLink).toHaveClass('underline');
	});

	it('does not apply underline class when inactive', () => {
		// Set the current page to a different route
		mockPage.set({
			url: new URL('http://localhost/'),
			params: {},
			route: { id: '/' },
			status: 200,
			error: null,
			data: {},
			form: null,
			state: {}
		});

		render(MenuItem, { to: '/about', item: 'About' });
		const links = screen.getAllByRole('link', { name: 'About' });
		const aboutLink = links.find(link => link.getAttribute('href') === '/about');
		expect(aboutLink).not.toHaveClass('underline');
	});
});
