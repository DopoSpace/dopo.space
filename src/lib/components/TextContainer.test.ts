import { describe, it } from 'vitest';
import { render } from '@testing-library/svelte';
import TextContainer from './TextContainer.svelte';
import { testElementClasses } from '$lib/test-utils/pageTestHelpers';

describe('TextContainer Component', () => {
	it('has large text size class', () => {
		const { container } = render(TextContainer, {
			children: () => 'Test'
		});
		testElementClasses(container, 'div', ['text-3xl']);
	});

	it('has responsive width classes', () => {
		const { container } = render(TextContainer, {
			children: () => 'Test'
		});
		testElementClasses(container, 'div', ['w-full', 'md:w-4/5']);
	});

	it('has correct padding classes', () => {
		const { container } = render(TextContainer, {
			children: () => 'Test'
		});
		testElementClasses(container, 'div', ['px-4', 'py-16']);
	});

	it('has flexbox and gap classes', () => {
		const { container } = render(TextContainer, {
			children: () => 'Test'
		});
		testElementClasses(container, 'div', ['flex', 'flex-col', 'gap-4']);
	});
});
