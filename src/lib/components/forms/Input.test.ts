import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import Input from './Input.svelte';

describe('Input Component', () => {
	it('renders label and input field', () => {
		render(Input, {
			name: 'uniqueTestField987',
			label: 'Unique Test Label 987'
		});

		expect(screen.getByLabelText('Unique Test Label 987')).toBeInTheDocument();
		const input = screen.getByRole('textbox', { name: 'Unique Test Label 987' });
		expect(input).toBeInTheDocument();
	});

	it('displays required asterisk when required prop is true', () => {
		render(Input, {
			name: 'uniqueTestField987',
			label: 'Unique Test Label 987',
			required: true
		});

		const labels = screen.getAllByText(/Unique Test Label 987/);
		const labelWithAsterisk = labels.find(label => label.textContent?.includes('*'));
		expect(labelWithAsterisk).toBeTruthy();
	});

	it('shows error message when error prop is provided', () => {
		const errorMessage = 'This is a unique error 987';

		render(Input, {
			name: 'uniqueTestField987',
			label: 'Unique Test Label 987',
			error: errorMessage
		});

		expect(screen.getByText(errorMessage)).toBeInTheDocument();
	});

	it('applies error styling when error is present', () => {
		const { container } = render(Input, {
			name: 'uniqueTestField987',
			label: 'Unique Test Label 987',
			error: 'Error message'
		});

		const testInput = container.querySelector('input[name="uniqueTestField987"]');
		expect(testInput).toHaveClass('border-red-500');
	});

	it('sets correct input attributes', () => {
		const { container } = render(Input, {
			name: 'uniqueEmailField987',
			label: 'Unique Email 987',
			type: 'email',
			value: 'unique987@example.com',
			placeholder: 'Enter unique email 987',
			required: true
		});

		const emailInput = container.querySelector('input[name="uniqueEmailField987"]') as HTMLInputElement;
		expect(emailInput).toHaveAttribute('type', 'email');
		expect(emailInput).toHaveAttribute('name', 'uniqueEmailField987');
		expect(emailInput).toHaveAttribute('placeholder', 'Enter unique email 987');
		expect(emailInput).toHaveAttribute('required');
		expect(emailInput.value).toBe('unique987@example.com');
	});

	it('sets aria attributes for accessibility', () => {
		const { container } = render(Input, {
			name: 'uniqueTestField987',
			label: 'Unique Test Label 987',
			error: 'Error message'
		});

		const testInput = container.querySelector('input[name="uniqueTestField987"]');
		expect(testInput).toHaveAttribute('aria-invalid', 'true');
		expect(testInput).toHaveAttribute('aria-describedby', 'uniqueTestField987-error');
	});
});
