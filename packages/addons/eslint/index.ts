import { addEslintConfigPrettier } from '../common.ts';
import { defineAddon, log } from '@sveltejs/cli-core';
import {
	array,
	common,
	exports,
	functions,
	imports,
	object,
	type AstKinds,
	type AstTypes
} from '@sveltejs/cli-core/js';
import { parseJson, parseScript } from '@sveltejs/cli-core/parsers';

export default defineAddon({
	id: 'eslint',
	shortDescription: 'linter',
	homepage: 'https://eslint.org',
	options: {},
	run: ({ sv, typescript, dependencyVersion }) => {
		const prettierInstalled = Boolean(dependencyVersion('prettier'));

		sv.devDependency('eslint', '^9.7.0');
		sv.devDependency('globals', '^15.0.0');
		sv.devDependency('eslint-plugin-svelte', '^2.36.0');

		if (typescript) sv.devDependency('typescript-eslint', '^8.0.0');

		if (prettierInstalled) sv.devDependency('eslint-config-prettier', '^9.1.0');

		sv.file('package.json', (content) => {
			const { data, generateCode } = parseJson(content);
			data.scripts ??= {};
			const scripts: Record<string, string> = data.scripts;
			const LINT_CMD = 'eslint .';
			scripts['lint'] ??= LINT_CMD;
			if (!scripts['lint'].includes(LINT_CMD)) scripts['lint'] += ` && ${LINT_CMD}`;
			return generateCode();
		});

		sv.file('.vscode/settings.json', (content) => {
			if (!content) return content;

			const { data, generateCode } = parseJson(content);
			const validate: string[] | undefined = data['eslint.validate'];
			if (validate && !validate.includes('svelte')) {
				validate.push('svelte');
			}
			return generateCode();
		});

		sv.file('eslint.config.js', (content) => {
			const { ast, generateCode } = parseScript(content);

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
				ignores: common.expressionFromString('["build/", ".svelte-kit/", "dist/", ".vercel/"]')
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
				return content;
			}

			// type annotate config
			if (!typescript)
				common.addJsDocTypeComment(defaultExport.astNode, "import('eslint').Linter.Config[]");

			// imports
			if (typescript) imports.addDefault(ast, 'typescript-eslint', 'ts');
			imports.addDefault(ast, 'globals', 'globals');
			imports.addDefault(ast, 'eslint-plugin-svelte', 'svelte');
			imports.addDefault(ast, '@eslint/js', 'js');

			return generateCode();
		});

		if (prettierInstalled) {
			sv.file('eslint.config.js', addEslintConfigPrettier);
		}
	}
});
