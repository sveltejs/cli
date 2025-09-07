import myPlugin from 'my-plugin';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig(() => {
	// Some stuff here
	return { plugins: [sveltekit(), myPlugin()] };
});
