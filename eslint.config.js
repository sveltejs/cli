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
			'packages/sv/lib/create/shared/**/*',
			'packages/sv/lib/create/scripts/**/*',
			'packages/sv/lib/create/templates/**/*',
			'packages/sv/lib/cli/tests/snapshots/*',
			'packages/sv/lib/**/tests/**/{output,input}.ts'
		]
	}
];
