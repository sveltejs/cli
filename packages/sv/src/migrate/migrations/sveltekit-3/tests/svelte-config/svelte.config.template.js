import adapter from '@sveltejs/adapter-node';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import { onwarn } from './config.logger.js';
import { helper } from './my-helper.js';

// derive paths and adapter config from the environment
const { paths, adapterConfig } = helper(process.env['SOME_ENV_VAR']);
const base = process.env['VITEST'] ? '' : '/some-base'; // empty base while testing

/** @type {import('@sveltejs/kit').Config} */
const config = {
	// Consult https://svelte.dev/docs/kit/integrations
	// for more information about preprocessors
	preprocess: vitePreprocess(),
	onwarn,
	kit: {
		experimental: {
			remoteFunctions: true, // still experimental
			handleRenderingErrors: true,
			tracing: {
				server: true,
			},
			instrumentation: {
				server: true
			}
		},
		csrf: {
			checkOrigin: false
		},
		prerender: { origin: 'https://example.com' },
		paths: { ...paths, base },
		preloadStrategy: 'modulepreload',
		// adapter is selected via the helper above
		adapter: adapter(adapterConfig)
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
