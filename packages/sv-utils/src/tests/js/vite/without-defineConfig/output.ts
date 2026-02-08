import myPlugin from 'my-plugin';
import { sveltekit } from '@sveltejs/kit/vite';
import type { UserConfig } from 'vite';

const config: UserConfig = { plugins: [myPlugin(), sveltekit()] };

export default config;
