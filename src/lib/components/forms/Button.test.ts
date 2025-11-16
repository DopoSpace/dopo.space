import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import ButtonTestWrapper from './ButtonTestWrapper.test.svelte';

describe('Button Component', () => {
	it('renders button element', () => {
		const { container } = render(ButtonTestWrapper, { text: 'UniqueTestButton123' });
		const button = container.querySelector('button');
		expect(button).toBeInTheDocument();
	});

	it('applies primary variant by default', () => {
		const { container } = render(ButtonTestWrapper, { text: 'UniqueTestButton123' });
		const button = Array.from(container.querySelectorAll('button')).find(
			btn => btn.textContent?.trim() === 'UniqueTestButton123'
		);
		expect(button).toHaveClass('btn-primary');
	});

	it('applies secondary variant when specified', () => {
		const { container } = render(ButtonTestWrapper, { text: 'UniqueTestButton123', variant: 'secondary' });
		const button = Array.from(container.querySelectorAll('button')).find(
			btn => btn.textContent?.trim() === 'UniqueTestButton123'
		);
		expect(button).toHaveClass('btn-secondary');
	});

	it('applies full width class when fullWidth is true', () => {
		const { container } = render(ButtonTestWrapper, { text: 'UniqueTestButton123', fullWidth: true });
		const button = Array.from(container.querySelectorAll('button')).find(
			btn => btn.textContent?.trim() === 'UniqueTestButton123'
		);
		expect(button).toHaveClass('w-full');
	});

	it('disables button when disabled prop is true', () => {
		const { container } = render(ButtonTestWrapper, { text: 'UniqueTestButton123', disabled: true });
		const button = Array.from(container.querySelectorAll('button')).find(
			btn => btn.textContent?.trim() === 'UniqueTestButton123'
		);
		expect(button).toBeDisabled();
	});

	it('disables button when loading is true', () => {
		const { container } = render(ButtonTestWrapper, { text: 'UniqueTestButton123', loading: true });
		const button = Array.from(container.querySelectorAll('button')).find(
			btn => btn.textContent?.includes('UniqueTestButton123')
		);
		expect(button).toBeDisabled();
	});

	it('applies disabled styling when disabled', () => {
		const { container } = render(ButtonTestWrapper, { text: 'UniqueTestButton123', disabled: true });
		const button = Array.from(container.querySelectorAll('button')).find(
			btn => btn.textContent?.trim() === 'UniqueTestButton123'
		);
		expect(button).toHaveClass('opacity-50');
		expect(button).toHaveClass('cursor-not-allowed');
	});

	it('sets correct button type', () => {
		const { container } = render(ButtonTestWrapper, { text: 'UniqueTestButton123', type: 'submit' });
		const button = Array.from(container.querySelectorAll('button')).find(
			btn => btn.textContent?.trim() === 'UniqueTestButton123'
		);
		expect(button).toHaveAttribute('type', 'submit');
	});
});
