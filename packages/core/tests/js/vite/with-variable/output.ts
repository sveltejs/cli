import myPlugin from 'my-plugin';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

const config = defineConfig({ plugins: [sveltekit(), myPlugin()] });

export default config;
