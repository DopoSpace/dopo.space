import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import FormCard from './FormCard.svelte';

describe('FormCard Component', () => {
	it('renders form card container', () => {
		render(FormCard, {
			props: {
				children: () => 'Form content here'
			}
		});

		const { container } = render(FormCard, {
			props: {
				children: () => 'Content'
			}
		});

		const card = container.firstChild as HTMLElement;
		expect(card).toBeInTheDocument();
	});

	it('renders title when provided', () => {
		render(FormCard, {
			props: {
				title: 'Form Title',
				children: () => 'Content'
			}
		});

		expect(screen.getByRole('heading', { name: 'Form Title' })).toBeInTheDocument();
	});

	it('does not render title heading when not provided', () => {
		render(FormCard, {
			props: {
				children: () => 'Content'
			}
		});

		const headings = screen.queryAllByRole('heading');
		expect(headings).toHaveLength(0);
	});

	it('applies card styling classes', () => {
		const { container } = render(FormCard, {
			props: {
				children: () => 'Content'
			}
		});

		const card = container.firstChild as HTMLElement;
		expect(card).toHaveClass('bg-white');
		expect(card).toHaveClass('rounded-lg');
		expect(card).toHaveClass('shadow-lg');
	});
});
