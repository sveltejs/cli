import myPlugin from 'my-plugin';
import { sveltekit } from '@sveltejs/kit/vite';

const plugins = [sveltekit(), myPlugin()];
const config = { plugins };

export default config;
