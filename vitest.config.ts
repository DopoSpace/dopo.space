import { defineConfig } from 'vitest/config';
import { sveltekit } from '@sveltejs/kit/vite';

export default defineConfig({
	plugins: [sveltekit()],
	test: {
		include: ['src/**/*.{test,spec}.{js,ts}'],
		exclude: [
			'**/node_modules/**',
			'**/dist/**',
			// Temporarily skip component tests - see docs/TESTING_ISSUES.md
			// Component tests will be migrated to Vitest Browser Mode
			'src/lib/components/**/*.test.ts',
			'src/routes/**/page.test.ts'
		],
		environment: 'jsdom',
		globals: true,
		setupFiles: ['./vitest.setup.ts'],
		coverage: {
			provider: 'v8',
			reporter: ['text', 'json', 'html'],
			exclude: [
				'node_modules/',
				'src/tests/',
				'**/*.spec.ts',
				'**/*.test.ts'
			]
		}
	}
});
