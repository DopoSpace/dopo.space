import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import FormCardTestWrapper from './FormCardTestWrapper.test.svelte';

describe('FormCard Component', () => {
	it('renders form card container', () => {
		const { container } = render(FormCardTestWrapper, { content: 'Unique Form Content 789' });
		const contentEl = screen.getByText('Unique Form Content 789');
		expect(contentEl).toBeInTheDocument();
	});

	it('renders title when provided', () => {
		render(FormCardTestWrapper, {
			title: 'Unique Form Title 789',
			content: 'Content'
		});

		const heading = screen.getByRole('heading', { name: 'Unique Form Title 789' });
		expect(heading).toBeInTheDocument();
	});

	it('does not render title heading when not provided', () => {
		const { container } = render(FormCardTestWrapper, { content: 'Unique Content Without Title 789' });
		
		// Check that there's no h2 or h3 heading containing our unique content
		const headings = container.querySelectorAll('h2, h3');
		const hasOurHeading = Array.from(headings).some(h => 
			h.textContent?.includes('Unique Content Without Title 789')
		);
		
		expect(hasOurHeading).toBe(false);
	});

	it('applies card styling classes', () => {
		const { container } = render(FormCardTestWrapper, { content: 'Unique Content 789' });
		const cards = container.querySelectorAll('.bg-white.rounded-lg.shadow-lg');
		expect(cards.length).toBeGreaterThan(0);
	});
});
