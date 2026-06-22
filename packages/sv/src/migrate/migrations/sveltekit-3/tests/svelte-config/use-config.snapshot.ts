// @migration-task svelte.config was removed; switch to `import { loadConfig } from '@sveltejs/load-config'` to read your config
import config from './svelte.config.js';

export const preprocessors = config.preprocess;
