import { createCommand } from '../utils/external-package.js';

export const kit = createCommand(
	'kit',
	'@sveltejs/kit',
	'svelte-kit',
	'a CLI for working with your SvelteKit project'
);
