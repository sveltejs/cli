import { createCommand } from '../utils/external-package.js';

export const check = createCommand(
	'check',
	'svelte-check',
	'svelte-check',
	'a CLI for checking your Svelte code'
);
