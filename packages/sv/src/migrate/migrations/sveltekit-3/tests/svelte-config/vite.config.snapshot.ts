import adapter from '@sveltejs/adapter-node';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import { onwarn } from './config.logger.js';
import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';
import devtoolsJson from 'vite-plugin-devtools-json';

export default defineConfig({
	plugins: [
		tailwindcss(),
		sveltekit({
			preprocess: vitePreprocess(),
			compilerOptions: { experimental: { async: true } },
			vitePlugin: { inspector: {}, onwarn },
			experimental: { remoteFunctions: true },
			// @migration-task trusting all origins with '*' is generally not recommended, see https://svelte.dev/docs/kit/configuration#csrf
			trustedOrigins: ['*'],
			adapter: adapter()
		}),
		devtoolsJson()
	]
});
