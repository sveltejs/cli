import { mdsvex } from 'mdsvex';
import adapter from '@sveltejs/adapter-node';

/** @type {import('@sveltejs/kit').Config} */ const config = {
	kit: {
		adapter: adapter(),
		typescript: {
			config: (tsconfig) => {
				tsconfig.include = [...tsconfig.include, '../e2e/**/*.ts', '../e2e/**/*.js'];
			}
		}
	},
	preprocess: [mdsvex()],
	extensions: ['.svelte', '.svx']
};

export default config;
