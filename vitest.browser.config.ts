import { defineConfig } from 'vitest/config';
import { sveltekit } from '@sveltejs/kit/vite';
import { playwright } from '@vitest/browser-playwright';

export default defineConfig({
	plugins: [sveltekit()],
	test: {
		// Only include component and page tests
		include: [
			'src/lib/components/**/*.test.ts',
			'src/routes/**/page.test.ts'
		],
		// Setup file for jest-dom matchers
		setupFiles: ['./src/test/setup-browser.ts'],
		// Browser mode configuration
		browser: {
			enabled: true,
			instances: [
				{
					browser: 'chromium',
					provider: playwright()
				}
			],
			headless: true
		},
		globals: true
	}
});
