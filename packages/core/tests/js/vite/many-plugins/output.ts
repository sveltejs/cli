import { firstPlugin } from 'first-plugin';
import lastPlugin from 'last-plugin';
import middlePlugin from 'middle-plugin';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [
		firstPlugin(),
		middlePlugin(),
		lastPlugin(0),
		lastPlugin(1),
		lastPlugin(2),
		lastPlugin(3),
		lastPlugin(4),
		lastPlugin(5),
		lastPlugin(6),
		lastPlugin(7),
		lastPlugin(8),
		lastPlugin(9)
	]
});
