import { describe, it } from 'vitest';
import { render } from '@testing-library/svelte';
import type { Snippet } from 'svelte';
import TextContainer from './TextContainer.svelte';
import { testElementClasses } from '$lib/test-utils/pageTestHelpers';

// Helper to create a mock snippet for testing
// In Svelte 5, children are Snippets, but testing-library doesn't fully support this yet
const mockChildren = (() => 'Test') as unknown as Snippet;

describe('TextContainer Component', () => {
	it('has large text size class', () => {
		const { container } = render(TextContainer, {
			children: mockChildren
		});
		testElementClasses(container, 'div', ['text-3xl']);
	});

	it('has responsive width classes', () => {
		const { container } = render(TextContainer, {
			children: mockChildren
		});
		testElementClasses(container, 'div', ['w-full', 'md:w-4/5']);
	});

	it('has correct padding classes', () => {
		const { container } = render(TextContainer, {
			children: mockChildren
		});
		testElementClasses(container, 'div', ['px-4', 'py-16']);
	});

	it('has flexbox and gap classes', () => {
		const { container } = render(TextContainer, {
			children: mockChildren
		});
		testElementClasses(container, 'div', ['flex', 'flex-col', 'gap-4']);
	});
});
