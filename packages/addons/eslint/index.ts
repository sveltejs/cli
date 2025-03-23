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

		sv.devDependency('eslint', '^9.18.0');
		sv.devDependency('@eslint/compat', '^1.2.5');
		sv.devDependency('eslint-plugin-svelte', '^3.0.0');
		sv.devDependency('globals', '^16.0.0');
		sv.devDependency('@eslint/js', '^9.18.0');

		if (typescript) sv.devDependency('typescript-eslint', '^8.20.0');

		if (prettierInstalled) sv.devDependency('eslint-config-prettier', '^10.0.1');

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

			imports.addDefault(ast, './svelte.config.js', 'svelteConfig');

			const gitIgnorePathStatement = common.statementFromString(
				'\nconst gitignorePath = fileURLToPath(new URL("./.gitignore", import.meta.url));'
			);
			common.addStatement(ast, gitIgnorePathStatement);

			const ignoresConfig = common.expressionFromString('includeIgnoreFile(gitignorePath)');
			eslintConfigs.push(ignoresConfig);

			const jsConfig = common.expressionFromString('js.configs.recommended');
			eslintConfigs.push(jsConfig);

			if (typescript) {
				const tsConfig = common.expressionFromString('ts.configs.recommended');
				eslintConfigs.push(common.createSpreadElement(tsConfig));
			}

			const svelteConfig = common.expressionFromString('svelte.configs.recommended');
			eslintConfigs.push(common.createSpreadElement(svelteConfig));

			const globalsBrowser = common.createSpreadElement(
				common.expressionFromString('globals.browser')
			);
			const globalsNode = common.createSpreadElement(common.expressionFromString('globals.node'));
			const globalsObjLiteral = object.createEmpty();
			globalsObjLiteral.properties = [globalsBrowser, globalsNode];
			const off = common.createLiteral('off');
			const rules = object.create({
				'"no-undef"': off
			});

			if (rules.properties[0].type !== 'ObjectProperty') {
				throw new Error('rules.properties[0].type !== "ObjectProperty"');
			}
			rules.properties[0].key.comments = [
				{
					type: 'Block',
					value:
						'*\n   * typescript-eslint strongly recommend that you do not use the no-undef lint rule on TypeScript projects.\n   * see: https://typescript-eslint.io/troubleshooting/faqs/eslint/#i-get-errors-from-the-no-undef-rule-about-global-variables-not-being-defined-even-though-there-are-no-typescript-errors\n ',
					leading: true,
					trailing: false
				}
			];

			const globalsConfig = object.create({
				languageOptions: object.create({
					globals: globalsObjLiteral
				}),
				rules: typescript ? rules : undefined
			});

			eslintConfigs.push(globalsConfig);

			if (typescript) {
				const svelteTSParserConfig = object.create({
					files: common.expressionFromString('["**/*.svelte", "**/*.svelte.ts", "**/*.svelte.js"]'),
					ignores: common.expressionFromString('["eslint.config.js", "svelte.config.js"]'),
					languageOptions: object.create({
						parserOptions: object.create({
							projectService: common.expressionFromString('true'),
							extraFileExtensions: common.expressionFromString("['.svelte']"),
							parser: common.expressionFromString('ts.parser'),
							svelteConfig: common.expressionFromString('svelteConfig')
						})
					})
				});
				eslintConfigs.push(svelteTSParserConfig);
			} else {
				const svelteTSParserConfig = object.create({
					files: common.expressionFromString('["**/*.svelte", "**/*.svelte.js"]'),
					languageOptions: object.create({
						parserOptions: object.create({
							svelteConfig: common.expressionFromString('svelteConfig')
						})
					})
				});
				eslintConfigs.push(svelteTSParserConfig);
			}

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
			imports.addNamed(ast, 'node:url', { fileURLToPath: 'fileURLToPath' });
			imports.addDefault(ast, 'globals', 'globals');
			imports.addDefault(ast, 'eslint-plugin-svelte', 'svelte');
			imports.addNamed(ast, '@eslint/compat', { includeIgnoreFile: 'includeIgnoreFile' });
			imports.addDefault(ast, '@eslint/js', 'js');

			return generateCode();
		});

		if (prettierInstalled) {
			sv.file('eslint.config.js', addEslintConfigPrettier);
		}
	}
});
