import myPlugin from 'my-plugin';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig as MyConf } from 'vite';

export default MyConf({ plugins: [sveltekit(), myPlugin()] });
