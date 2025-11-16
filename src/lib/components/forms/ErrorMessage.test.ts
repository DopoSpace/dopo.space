import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import ErrorMessageTestWrapper from '$lib/test-utils/component-wrappers/ErrorMessageWrapper.test.svelte';

describe('ErrorMessage Component', () => {
	it('renders alert container', () => {
		render(ErrorMessageTestWrapper, { text: 'This is an error message' });
		const alerts = screen.getAllByRole('alert');
		expect(alerts.length).toBeGreaterThan(0);
	});

	it('has alert role for accessibility', () => {
		render(ErrorMessageTestWrapper, { text: 'Error' });
		const alerts = screen.getAllByRole('alert');
		const errorAlert = alerts.find(alert => alert.textContent?.includes('Error'));
		expect(errorAlert).toBeInTheDocument();
	});

	it('applies error styling classes', () => {
		const { container } = render(ErrorMessageTestWrapper, { text: 'Error' });
		const alerts = container.querySelectorAll('[role="alert"]');
		const errorAlert = Array.from(alerts).find(alert => alert.textContent?.includes('Error'));
		expect(errorAlert).toHaveClass('bg-red-50');
		expect(errorAlert).toHaveClass('border-red-200');
		expect(errorAlert).toHaveClass('text-red-800');
	});
});
