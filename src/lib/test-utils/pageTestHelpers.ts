import { screen } from '@testing-library/svelte';
import { expect } from 'vitest';

/**
 * Test helper: Verifies that navigation menu contains all required links
 */
export function testNavigationMenu() {
	const homeLink = screen.getByRole('link', { name: 'Home' });
	const aboutLink = screen.getByRole('link', { name: 'About' });
	const contactLink = screen.getByRole('link', { name: 'Contact' });

	expect(homeLink).toBeInTheDocument();
	expect(aboutLink).toBeInTheDocument();
	expect(contactLink).toBeInTheDocument();
}

/**
 * Test helper: Verifies that the page has red background
 */
export function testRedBackground(container: HTMLElement) {
	const redBg = container.querySelector('.bg-dopoRed');
	expect(redBg).toBeInTheDocument();
}

/**
 * Test helper: Verifies CSS classes on an element
 */
export function testElementClasses(
	container: HTMLElement,
	selector: string,
	classes: string[]
) {
	const element = container.querySelector(selector);
	expect(element).toBeInTheDocument();
	expect(element).toHaveClass(...classes);
}

/**
 * Test helper: Verifies external link attributes (href, target, rel, underline)
 */
export function testExternalLink(
	linkName: string | RegExp,
	expectedHref: string,
	shouldHaveRel = true
) {
	const link = screen.getByRole('link', { name: linkName });

	expect(link).toBeInTheDocument();
	expect(link).toHaveAttribute('href', expectedHref);
	expect(link).toHaveAttribute('target', '_blank');
	expect(link).toHaveClass('underline');

	if (shouldHaveRel) {
		expect(link).toHaveAttribute('rel', 'noopener noreferrer');
	}
}
