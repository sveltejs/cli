import adapter from '@sveltejs/adapter-node';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import { onwarn } from './config.logger.js';
import { helper } from './my-helper.js';
import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';
import devtoolsJson from 'vite-plugin-devtools-json';

// derive paths and adapter config from the environment
const { paths, adapterConfig } = helper(process.env['SOME_ENV_VAR']);
const base = process.env['VITEST'] ? '' : '/some-base'; // empty base while testing
export default defineConfig({
	plugins: [
		tailwindcss(),
		sveltekit({
			// Consult https://svelte.dev/docs/kit/integrations
			// for more information about preprocessors
			preprocess: vitePreprocess(),
			compilerOptions: { experimental: { async: true } },
			vitePlugin: { inspector: {}, onwarn },
			experimental: { remoteFunctions: true /* still experimental */ },
			// @migration-task trusting all origins with '*' is generally not recommended, see https://svelte.dev/docs/kit/configuration#csrf
			trustedOrigins: ['*'],
			paths: { ...paths, base },
			// adapter is selected via the helper above
			adapter: adapter(adapterConfig)
		}),
		devtoolsJson()
	]
});
