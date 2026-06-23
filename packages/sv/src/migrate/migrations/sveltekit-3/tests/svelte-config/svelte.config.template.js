import adapter from '@sveltejs/adapter-node';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import { onwarn } from './config.logger.js';
import { helper } from './my-helper.js';

const { paths, adapterConfig } = helper(process.env['SOME_ENV_VAR']);
const base = process.env['VITEST'] ? '' : '/some-base';

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
		paths: { ...paths, base },
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
