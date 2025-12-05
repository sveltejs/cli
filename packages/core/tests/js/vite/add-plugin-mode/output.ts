import { firstPlugin } from 'first-plugin';
import lastPlugin from 'last-plugin';
import middlePlugin from 'middle-plugin';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [
		firstPlugin(),

		// a default plugin
		sveltekit(),

		middlePlugin(),
		lastPlugin()
	]
});
