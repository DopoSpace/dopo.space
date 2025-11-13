import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import Menu from './Menu.svelte';
import { testElementClasses } from '$lib/test-utils/pageTestHelpers';

describe('Menu Component', () => {
	it('renders all three navigation links', () => {
		render(Menu);

		const homeLink = screen.getByRole('link', { name: 'Home' });
		const aboutLink = screen.getByRole('link', { name: 'About' });
		const contactLink = screen.getByRole('link', { name: 'Contact' });

		expect(homeLink).toBeInTheDocument();
		expect(aboutLink).toBeInTheDocument();
		expect(contactLink).toBeInTheDocument();
	});

	it('has correct href attributes', () => {
		render(Menu);

		const homeLink = screen.getByRole('link', { name: 'Home' });
		const aboutLink = screen.getByRole('link', { name: 'About' });
		const contactLink = screen.getByRole('link', { name: 'Contact' });

		expect(homeLink).toHaveAttribute('href', '/');
		expect(aboutLink).toHaveAttribute('href', '/about');
		expect(contactLink).toHaveAttribute('href', '/contact');
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
		testElementClasses(container, 'div.flex', ['flex', 'justify-start', 'items-center', 'gap-4']);
	});
});
