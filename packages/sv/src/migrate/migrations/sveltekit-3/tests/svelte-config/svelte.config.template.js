import adapter from '@sveltejs/adapter-node';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import { onwarn } from './config.logger.js';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	// Consult https://svelte.dev/docs/kit/integrations
	// for more information about preprocessors
	preprocess: vitePreprocess(),
	onwarn,
	kit: {
		experimental: {
			remoteFunctions: true
		},
		csrf: {
			checkOrigin: false
		},
		adapter: adapter()
	},
	compilerOptions: {
		experimental: {
			async: true
		}
	},
	vitePlugin: {
		inspector: {}
	}
};

export default config;
