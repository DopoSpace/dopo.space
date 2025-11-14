import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

// Global mock for $app/stores - writable store that can be updated in tests
vi.mock('$app/stores', () => {
	const { writable } = require('svelte/store');
	return {
		page: writable({
			url: new URL('http://localhost/'),
			params: {},
			route: { id: '/' },
			status: 200,
			error: null,
			data: {},
			form: null
		})
	};
});

// Global mock for $app/forms - enhance action
vi.mock('$app/forms', () => {
	return {
		enhance: () => {
			return () => {};
		}
	};
});

// Global mock for $app/navigation - goto function
vi.mock('$app/navigation', () => {
	return {
		goto: vi.fn()
	};
});
