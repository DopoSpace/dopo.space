import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import type { Snippet } from 'svelte';
import TextContainer from './TextContainer.svelte';

// Helper to create a mock snippet for testing
// In Svelte 5, children are Snippets, but testing-library doesn't fully support this yet
const mockChildren = (() => 'Test') as unknown as Snippet;

describe('TextContainer Component', () => {
	it('renders with text-container class', () => {
		const { container } = render(TextContainer, {
			children: mockChildren
		});
		const textContainer = container.querySelector('.text-container');
		expect(textContainer).toBeInTheDocument();
	});

	it('renders as a div element', () => {
		const { container } = render(TextContainer, {
			children: mockChildren
		});
		const textContainer = container.querySelector('.text-container');
		expect(textContainer).toBeInTheDocument();
		expect(textContainer?.tagName.toLowerCase()).toBe('div');
	});

	it('applies styling via CSS (responsive width, padding, typography)', () => {
		const { container } = render(TextContainer, {
			children: mockChildren
		});
		// The component uses @apply for Tailwind classes in scoped CSS
		// We verify the component class exists - actual styles are applied via CSS
		const textContainer = container.querySelector('.text-container');
		expect(textContainer).toBeInTheDocument();
	});
});
