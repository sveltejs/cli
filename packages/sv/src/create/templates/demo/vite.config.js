import adapter from '@sveltejs/adapter-auto';
import { sveltekit } from '@sveltejs/kit/vite';
import path from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [
		sveltekit({
			adapter: adapter()
		})
	],

	server: {
		fs: {
			allow: [path.resolve('../../../kit')]
		}
	}
});
