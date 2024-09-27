// @ts-expect-error
import svelte_config from '@sveltejs/eslint-config';

/** @type {import('eslint').Linter.Config[]} */
export default [
	...svelte_config,
	{
		rules: {
			'no-undef': 'off'
		}
	},
	{
		languageOptions: {
			parserOptions: {
				project: true
			}
		},
		rules: {
			'@typescript-eslint/await-thenable': 'error',
			'@typescript-eslint/no-unused-expressions': 'off',
			'@typescript-eslint/require-await': 'error'
		}
	},
	{
		ignores: [
			'packages/create/shared/**/*',
			'packages/create/scripts/**/*',
			'packages/create/templates/**/*',
			'temp/**/*',
			'.test-tmp/**/*',
			'**/dist/*',
			'packages/**/tests/**/{output,input}.ts',
			'rollup.config.js'
		]
	}
];
