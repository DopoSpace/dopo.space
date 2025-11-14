import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import Button from './Button.svelte';

describe('Button Component', () => {
	it('renders button element', () => {
		render(Button, {
			props: {
				children: () => 'Click me'
			}
		});

		const button = screen.getByRole('button');
		expect(button).toBeInTheDocument();
	});

	it('applies primary variant by default', () => {
		render(Button, {
			props: {
				children: () => 'Button'
			}
		});

		expect(screen.getByRole('button')).toHaveClass('btn-primary');
	});

	it('applies secondary variant when specified', () => {
		render(Button, {
			props: {
				variant: 'secondary',
				children: () => 'Button'
			}
		});

		expect(screen.getByRole('button')).toHaveClass('btn-secondary');
	});

	it('applies full width class when fullWidth is true', () => {
		render(Button, {
			props: {
				fullWidth: true,
				children: () => 'Button'
			}
		});

		expect(screen.getByRole('button')).toHaveClass('w-full');
	});

	it('disables button when disabled prop is true', () => {
		render(Button, {
			props: {
				disabled: true,
				children: () => 'Button'
			}
		});

		expect(screen.getByRole('button')).toBeDisabled();
	});

	it('disables button when loading is true', () => {
		render(Button, {
			props: {
				loading: true,
				children: () => 'Button'
			}
		});

		expect(screen.getByRole('button')).toBeDisabled();
	});

	it('applies disabled styling when disabled', () => {
		render(Button, {
			props: {
				disabled: true,
				children: () => 'Button'
			}
		});

		expect(screen.getByRole('button')).toHaveClass('opacity-50');
		expect(screen.getByRole('button')).toHaveClass('cursor-not-allowed');
	});

	it('sets correct button type', () => {
		render(Button, {
			props: {
				type: 'submit',
				children: () => 'Submit'
			}
		});

		expect(screen.getByRole('button')).toHaveAttribute('type', 'submit');
	});
});
