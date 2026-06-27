import js from '@eslint/js';
import svelte from 'eslint-plugin-svelte';
import { defineConfig } from 'eslint/config';
// @migration-task svelteConfig should not be needed anymore, see https://github.com/sveltejs/eslint-plugin-svelte/issues/1550
import svelteConfig from './svelte.config.js';

export default defineConfig(
	js.configs.recommended,
	...svelte.configs.recommended,
	{
		files: ['**/*.svelte', '**/*.svelte.js'],
		languageOptions: {
			parserOptions: {
				svelteConfig
			}
		}
	}
);
