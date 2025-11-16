import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import Logo from './Logo.svelte';
import { testElementClasses } from '$lib/test-utils/pageTestHelpers';

describe('Logo Component', () => {
	it('renders logo image with correct alt text', () => {
		render(Logo);
		const logos = screen.getAllByAltText('Dopo? Space');
		expect(logos.length).toBeGreaterThan(0);
		expect(logos[0]).toBeInTheDocument();
	});

	it('logo image has correct role', () => {
		render(Logo);
		const logos = screen.getAllByRole('img', { name: 'Dopo? Space' });
		expect(logos.length).toBeGreaterThan(0);
		expect(logos[0]).toBeInTheDocument();
	});

	it('has correct layout classes for centering', () => {
		const { container } = render(Logo);
		testElementClasses(container, 'div', ['min-h-screen', 'flex', 'justify-center', 'items-center']);
	});

	it('has responsive padding classes', () => {
		const { container } = render(Logo);
		testElementClasses(container, 'div', ['px-4', 'md:px-4', 'lg:px-16']);
	});

	it('has overflow-hidden class', () => {
		const { container } = render(Logo);
		testElementClasses(container, 'div', ['overflow-hidden']);
	});

	it('image has w-full class for responsive width', () => {
		render(Logo);
		const logos = screen.getAllByAltText('Dopo? Space');
		expect(logos[0]).toHaveClass('w-full');
	});
});
