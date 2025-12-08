import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import { writable } from 'svelte/store';
import type { Page } from '@sveltejs/kit';
import Menu from './Menu.svelte';
import { testElementClasses } from '$lib/test-utils/pageTestHelpers';

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
