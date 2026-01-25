import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [sveltekit()],
	server: {
		host: true, // Listen on all interfaces (needed for lvh.me subdomain access)
		allowedHosts: ['lvh.me', 'admin.lvh.me']
	}
});
