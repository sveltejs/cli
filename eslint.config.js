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
				projectService: true
			}
		},
		rules: {
			eqeqeq: 'error',
			'@typescript-eslint/await-thenable': 'error',
			'@typescript-eslint/no-unused-expressions': 'off',
			'@typescript-eslint/require-await': 'error'
		}
	},
	{
		ignores: [
			'**/temp/*',
			'**/.test-output/*',
			'**/dist/*',
			'packages/sv/src/create/shared/**/*',
			'packages/sv/src/create/scripts/**/*',
			'packages/sv/src/create/templates/**/*',
			'packages/sv/src/cli/tests/snapshots/*',
			'packages/sv/src/**/tests/**/{output,input}.ts',
			'packages/sv-utils/src/**/tests/**/{output,input}.ts'
		]
	}
];
