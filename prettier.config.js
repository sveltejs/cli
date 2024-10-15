const packageSortOrder = [
	// key info
	'name',
	'private',
	'version',
	'type',

	// meta
	'description',
	'license',
	'repository',
	'author',
	'homepage',
	'bugs',

	// constraints
	'engines',
	'cpu',
	'os',

	// scripts
	'scripts',

	// entry
	'files',
	'sideEffects',
	'bin',
	'main',
	'module',
	'svelte',
	'types',
	'exports',

	// dependencies
	'bundledDependencies',
	'optionalDependencies',
	'peerDependencies',
	'peerDependenciesMeta',
	'dependencies',
	'devDependencies',
	'resolutions',

	// last because prettier puts one keyword per line
	'keywords'
];

export default {
	useTabs: true,
	singleQuote: true,
	trailingComma: 'none',
	printWidth: 100,
	plugins: ['prettier-plugin-packagejson', 'prettier-plugin-svelte'],
	overrides: [
		{
			files: ['*.svelte'],
			options: {
				bracketSameLine: false
			}
		},
		{
			files: ['packages/*/README.md'],
			options: {
				useTabs: false,
				tabWidth: 2
			}
		},
		{
			files: ['**/CHANGELOG.md'],
			options: {
				requirePragma: true
			}
		},
		{
			files: 'package.json',
			options: {
				packageSortOrder
			}
		}
	]
}
