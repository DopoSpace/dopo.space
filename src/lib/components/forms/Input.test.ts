import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import Input from './Input.svelte';

describe('Input Component', () => {
	it('renders label and input field', () => {
		render(Input, {
			props: {
				name: 'testField',
				label: 'Test Label'
			}
		});

		expect(screen.getByLabelText('Test Label')).toBeInTheDocument();
		expect(screen.getByRole('textbox')).toBeInTheDocument();
	});

	it('displays required asterisk when required prop is true', () => {
		render(Input, {
			props: {
				name: 'testField',
				label: 'Test Label',
				required: true
			}
		});

		const label = screen.getByText(/Test Label/);
		expect(label.textContent).toContain('*');
	});

	it('shows error message when error prop is provided', () => {
		const errorMessage = 'This field is required';

		render(Input, {
			props: {
				name: 'testField',
				label: 'Test Label',
				error: errorMessage
			}
		});

		expect(screen.getByText(errorMessage)).toBeInTheDocument();
	});

	it('applies error styling when error is present', () => {
		render(Input, {
			props: {
				name: 'testField',
				label: 'Test Label',
				error: 'Error message'
			}
		});

		const input = screen.getByRole('textbox');
		expect(input).toHaveClass('border-red-500');
	});

	it('sets correct input attributes', () => {
		render(Input, {
			props: {
				name: 'email',
				label: 'Email',
				type: 'email',
				value: 'test@example.com',
				placeholder: 'Enter email',
				required: true
			}
		});

		const input = screen.getByRole('textbox') as HTMLInputElement;
		expect(input).toHaveAttribute('type', 'email');
		expect(input).toHaveAttribute('name', 'email');
		expect(input).toHaveAttribute('placeholder', 'Enter email');
		expect(input).toHaveAttribute('required');
		expect(input.value).toBe('test@example.com');
	});

	it('sets aria attributes for accessibility', () => {
		render(Input, {
			props: {
				name: 'testField',
				label: 'Test Label',
				error: 'Error message'
			}
		});

		const input = screen.getByRole('textbox');
		expect(input).toHaveAttribute('aria-invalid', 'true');
		expect(input).toHaveAttribute('aria-describedby', 'testField-error');
	});
});
