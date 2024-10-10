import fs from 'node:fs';
import path from 'node:path';
import { options } from './options.ts';
import { addEslintConfigPrettier } from '../../common.ts';
import { defineAdder, log, type AstKinds, type AstTypes } from '@svelte-cli/core';
import { array, common, exports, functions, imports, object } from '@svelte-cli/core/js';

export const adder = defineAdder({
	metadata: {
		id: 'eslint',
		name: 'ESLint',
		description: 'A configurable JavaScript linter',
		environments: { svelte: true, kit: true },
		website: {
			logo: './eslint.svg',
			keywords: ['eslint', 'code', 'linter'],
			documentation: 'https://eslint.org'
		}
	},
	options,
	packages: [
		{ name: 'eslint', version: '^9.7.0', dev: true },
		{ name: '@types/eslint', version: '^9.6.0', dev: true },
		{ name: 'globals', version: '^15.0.0', dev: true },
		{
			name: 'typescript-eslint',
			version: '^8.0.0',
			dev: true,
			condition: ({ typescript }) => typescript
		},
		{ name: 'eslint-plugin-svelte', version: '^2.36.0', dev: true },
		{
			name: 'eslint-config-prettier',
			version: '^9.1.0',
			dev: true,
			condition: ({ prettier }) => prettier
		}
	],
	files: [
		{
			name: () => 'package.json',
			contentType: 'json',
			content: ({ data }) => {
				data.scripts ??= {};
				const scripts: Record<string, string> = data.scripts;
				const LINT_CMD = 'eslint .';
				scripts['lint'] ??= LINT_CMD;
				if (!scripts['lint'].includes(LINT_CMD)) scripts['lint'] += ` && ${LINT_CMD}`;
			}
		},
		{
			name: () => '.vscode/settings.json',
			contentType: 'json',
			// we'll only want to run this step if the file exists
			condition: ({ cwd }) => fs.existsSync(path.join(cwd, '.vscode', 'settings.json')),
			content: ({ data }) => {
				const validate: string[] | undefined = data['eslint.validate'];
				if (validate && !validate.includes('svelte')) {
					validate.push('svelte');
				}
			}
		},
		{
			name: () => 'eslint.config.js',
			contentType: 'script',
			content: ({ ast, typescript }) => {
				const eslintConfigs: Array<
					AstKinds.ExpressionKind | AstTypes.SpreadElement | AstTypes.ObjectExpression
				> = [];

				const jsConfig = common.expressionFromString('js.configs.recommended');
				eslintConfigs.push(jsConfig);

				if (typescript) {
					const tsConfig = common.expressionFromString('ts.configs.recommended');
					eslintConfigs.push(common.createSpreadElement(tsConfig));
				}

				const svelteConfig = common.expressionFromString('svelte.configs["flat/recommended"]');
				eslintConfigs.push(common.createSpreadElement(svelteConfig));

				const globalsBrowser = common.createSpreadElement(
					common.expressionFromString('globals.browser')
				);
				const globalsNode = common.createSpreadElement(common.expressionFromString('globals.node'));
				const globalsObjLiteral = object.createEmpty();
				globalsObjLiteral.properties = [globalsBrowser, globalsNode];
				const globalsConfig = object.create({
					languageOptions: object.create({
						globals: globalsObjLiteral
					})
				});
				eslintConfigs.push(globalsConfig);

				if (typescript) {
					const svelteTSParserConfig = object.create({
						files: common.expressionFromString('["**/*.svelte"]'),
						languageOptions: object.create({
							parserOptions: object.create({
								parser: common.expressionFromString('ts.parser')
							})
						})
					});
					eslintConfigs.push(svelteTSParserConfig);
				}

				const ignoresConfig = object.create({
					ignores: common.expressionFromString('["build/", ".svelte-kit/", "dist/"]')
				});
				eslintConfigs.push(ignoresConfig);

				let exportExpression: AstTypes.ArrayExpression | AstTypes.CallExpression;
				if (typescript) {
					const tsConfigCall = functions.call('ts.config', []);
					tsConfigCall.arguments.push(...eslintConfigs);
					exportExpression = tsConfigCall;
				} else {
					const eslintArray = array.createEmpty();
					eslintConfigs.map((x) => array.push(eslintArray, x));
					exportExpression = eslintArray;
				}

				const defaultExport = exports.defaultExport(ast, exportExpression);
				// if it's not the config we created, then we'll leave it alone and exit out
				if (defaultExport.value !== exportExpression) {
					log.warn('An eslint config is already defined. Skipping initialization.');
					return;
				}

				// type annotate config
				if (!typescript)
					common.addJsDocTypeComment(defaultExport.astNode, "import('eslint').Linter.Config[]");

				// imports
				if (typescript) imports.addDefault(ast, 'typescript-eslint', 'ts');
				imports.addDefault(ast, 'globals', 'globals');
				imports.addDefault(ast, 'eslint-plugin-svelte', 'svelte');
				imports.addDefault(ast, '@eslint/js', 'js');
			}
		},
		{
			name: () => 'eslint.config.js',
			contentType: 'script',
			condition: ({ prettier }) => prettier,
			content: addEslintConfigPrettier
		}
	]
});
