import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import ErrorMessage from './ErrorMessage.svelte';

describe('ErrorMessage Component', () => {
	it('renders alert container', () => {
		render(ErrorMessage, {
			props: {
				children: () => 'This is an error message'
			}
		});

		expect(screen.getByRole('alert')).toBeInTheDocument();
	});

	it('has alert role for accessibility', () => {
		render(ErrorMessage, {
			props: {
				children: () => 'Error'
			}
		});

		expect(screen.getByRole('alert')).toBeInTheDocument();
	});

	it('applies error styling classes', () => {
		const { container } = render(ErrorMessage, {
			props: {
				children: () => 'Error'
			}
		});

		const errorDiv = container.querySelector('[role="alert"]');
		expect(errorDiv).toHaveClass('bg-red-50');
		expect(errorDiv).toHaveClass('border-red-200');
		expect(errorDiv).toHaveClass('text-red-800');
	});
});
