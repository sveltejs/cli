import { defineConfig } from 'oxfmt';

export default defineConfig({
	useTabs: true,
	singleQuote: true,
	trailingComma: 'none',
	printWidth: 100,
	endOfLine: 'lf',
	sortPackageJson: true,
	sortImports: {
		newlinesBetween: false
	},
	svelte: true,
	ignorePatterns: [
		'packages/sv/src/cli/tests/snapshots/*',
		'packages/sv/src/migrate/migrations/**/tests/*',
		'packages/sv-utils/src/tests/**/output.ts',
		'packages/sv/src/create/shared/+skills/*',
		'**/CHANGELOG.md',
		'packages/migrate/migrations/routes/*/samples.md',
		'.changeset/**'
	],
	overrides: [
		{
			files: ['packages/*/README.md'],
			options: {
				useTabs: false,
				tabWidth: 2
			}
		}
	]
});
