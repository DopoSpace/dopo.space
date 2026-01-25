import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

// Global mock for $env/dynamic/private - includes Resend config
vi.mock('$env/dynamic/private', () => ({
	env: {
		RESEND_API_KEY: 're_test_mock_api_key_12345',
		EMAIL_FROM: 'Test <test@example.com>',
		GOOGLE_PLACES_API_KEY: undefined
	}
}));

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
