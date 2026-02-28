import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

const plugins = [sveltekit(), myPlugin()];

export default defineConfig({ plugins });
