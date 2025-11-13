import { defineConfig } from 'vitest/config';
import { sveltekit } from '@sveltejs/kit/vite';

export default defineConfig({
	plugins: [sveltekit()],
	resolve: {
		conditions: ['browser']
	},
	test: {
		include: ['src/**/*.{test,spec}.{js,ts}'],
		environment: 'happy-dom',
		globals: true,
		setupFiles: ['./vitest.setup.ts']
	}
});
