import { log } from '@clack/prompts';
import { transforms } from '@sveltejs/sv-utils';
import { defineAddon, defineAddonOptions } from '../core/config.ts';

const options = defineAddonOptions()
	.add('validate', {
		type: 'multiselect',
		question: 'What files should Stylelint validate?',
		default: ['svelte', 'css'],
		options: [
			{ value: 'svelte', label: 'Svelte', hint: 'Lint my Svelte files' },
			{ value: 'css', label: 'CSS', hint: 'Lint my CSS files' },
			{ value: 'sass', label: 'SASS', hint: 'Lint my SASS files' },
			{ value: 'scss', label: 'SCSS', hint: 'Lint my SCSS files' },
		],
		required: false
	})
	.add('plugins', {
		type: 'multiselect',
		question: 'Would you like to add other Stylelint plugins?',
		default: ['stylistic'],
		options: [
			{ value: 'stylistic', label: 'Stylistic', hint: 'A formatter for your css.' },
		],
		required: false
	})
	.add('save', {
		type: 'select',
		question: 'When should Stylelint run on save?',
		default: 'always',
		options: [
			{ value: 'explicit', label: 'Explicitly', hint: 'Only if the user manually saves.' },
			{ value: 'always', label: 'Always', hint: 'Whenever your files get saved.' },
		],
	})
	.build();

export default defineAddon({
	id: 'stylelint',
	shortDescription: 'linter',
	homepage: 'https://stylelint.io/',
	options,
	run: ({ sv, options, dependencyVersion, file }) => {
		const sass = Boolean(dependencyVersion('sass'));
		const stylistic = options.plugins.includes('stylistic');

		sv.devDependency('stylelint', '^17.11.1');
		sv.devDependency('stylelint-config-standard', '^40.0.0')
		sv.devDependency('postcss', '^8.5.8');
		sv.devDependency('postcss-html', '^1.8.1');

		if (sass) {
			sv.devDependency('postcss-scss', '^4.0.9');
			sv.devDependency('stylelint-scss', '^7.1.1');
			sv.devDependency('stylelint-config-standard-scss', '^17.0.0')
		}

		if (stylistic) {
			sv.devDependency('@stylistic/stylelint-plugin', '^5.1.0');
			sv.devDependency('@stylistic/stylelint-config', '^5.0.0');
		}

		sv.file(
			file.package,
			transforms.json(({ data, json }) => {
				json.packageScriptsUpsert(data, 'lintcss', 'stylelint "**/*.css"');
			})
		);

		sv.file(
			'stylelint.config.js',
			transforms.script(({ ast, js }) => {
				if (sass) {
					js.imports.addDefault(ast, { from: 'postcss-scss', as: 'postcssSass' });
				}

				// Add this line right after the import:
				// /** @type {import('stylelint').Config} */
				const sampleConfig = {
					extends: ['stylelint-config-standard'], // others
					plugins: [] as string[], // add stylelistic and stylelint
					// customSyntax: postcssScss,
					defaultSeverity: 'warning',  // make option
					overrides: [
						{
							files: ['*.svelte', '**/*.svelte'],
							customSyntax: 'postcss-html'
						}
					],
					rules: {}
				};

				if (sass) {
					sampleConfig.extends.push('stylelint-config-standard-scss');
					sampleConfig.plugins.push('stylelint-scss');

					Object.defineProperty(sampleConfig, 'customSyntax', {
						value: 'postcssScss'
					});
				}

				if (stylistic) {
					sampleConfig.extends.push('@stylistic/stylelint-config');
					sampleConfig.plugins.push('@stylistic/stylelint-plugin');
				}

				const config = js.object.create(sampleConfig);
				const { value: defaultExport } = js.exports.createDefault(ast, {
					fallback: config
				});

				// If it's not the config we created, then we'll leave it alone and exit out
				if (defaultExport !== config) {
					log.warn('An stylelint config is already defined. Skipping initialization.');
					return false;
				}

			})
		);

		sv.file(
			'.vscode/extensions.json',
			transforms.json(({ data, json }) => {
				json.arrayUpsert(data, 'recommendations', 'stylelint.vscode-stylelint');

				// TODO: add these as settings
				// "stylelint.validate": [
				//     "css",           options.validate.includes('css')
				//     "scss",			options.validate.includes('scss')
				//     "sass",			options.validate.includes('sass')
				//     "svelte", 		options.validate.includes('svelte')
				// ],
				// "editor.codeActionsOnSave": {
				//     options.save.includes('always' | 'explicit)
				//     "source.fixAll.stylelint": "always" | "explicit"
				// },
			})
		);


	}
});
