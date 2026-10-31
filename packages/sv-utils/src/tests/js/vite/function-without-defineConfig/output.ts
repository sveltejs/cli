import myPlugin from 'my-plugin';
import { sveltekit } from '@sveltejs/kit/vite';

export default () => ({ plugins: [sveltekit(), myPlugin()] });
