import { firstPlugin } from 'first-plugin';
import lastPlugin from 'last-plugin';
import middlePlugin from 'middle-plugin';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [
		firstPlugin(),
		middlePlugin(),
		lastPlugin()
	]
});
