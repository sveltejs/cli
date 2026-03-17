import { mdsvex } from 'mdsvex';
import adapter from '@sveltejs/adapter-node';
import { relative, sep } from 'node:path';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	kit: { adapter: adapter() },
	vitePlugin: {
		// ensures rune mode is used by default, but allows for dependencies to use legacy mode
		// to be removed in svelte 6
		dynamicCompileOptions: ({ filename }) => {
			const relativePath = relative(import.meta.dirname, filename);
			const pathSegments = relativePath.toLowerCase().split(sep);
			const isExternalLibrary = pathSegments.includes('node_modules');

			if (isExternalLibrary) {
				return undefined;
			} else {
				return { runes: true };
			}
		}
	},
	preprocess: [mdsvex()],
	extensions: ['.svelte', '.svx']
};

export default config;
