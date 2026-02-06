import { log } from '@clack/prompts';
import { type AstTypes, js, parse, json } from '@sveltejs/sv-utils';
import { defineAddon } from '../addon/config.ts';
import { addEslintConfigPrettier, getNodeTypesVersion } from './_engine/common.ts';

export default defineAddon({
	id: 'eslint',
	shortDescription: 'linter',
	homepage: 'https://eslint.org',
	options: {},
	run: ({ sv, language, dependencyVersion, files }) => {
		const typescript = language === 'ts';
		const prettierInstalled = Boolean(dependencyVersion('prettier'));

		sv.devDependency('eslint', '^9.39.2');
		sv.devDependency('@eslint/compat', '^2.0.2');
		sv.devDependency('eslint-plugin-svelte', '^3.14.0');
		sv.devDependency('globals', '^17.3.0');
		sv.devDependency('@eslint/js', '^9.39.2');
		sv.devDependency('@types/node', getNodeTypesVersion());

		if (typescript) sv.devDependency('typescript-eslint', '^8.54.0');

		if (prettierInstalled) sv.devDependency('eslint-config-prettier', '^10.1.8');

		sv.file(files.package, (content) => {
			const { data, generateCode } = parse.json(content);

			json.packageScriptsUpsert(data, 'lint', 'eslint .');

			return generateCode();
		});

		sv.file(files.eslintConfig, (content) => {
			const { ast, comments, generateCode } = parse.script(content);

			const eslintConfigs: Array<AstTypes.Expression | AstTypes.SpreadElement> = [];
			js.imports.addDefault(ast, { from: './svelte.config.js', as: 'svelteConfig' });
			const gitIgnorePathStatement = js.common.parseStatement(
				"\nconst gitignorePath = path.resolve(import.meta.dirname, '.gitignore');"
			);
			js.common.appendStatement(ast, { statement: gitIgnorePathStatement });

			const ignoresConfig = js.common.parseExpression('includeIgnoreFile(gitignorePath)');
			eslintConfigs.push(ignoresConfig);

			const jsConfig = js.common.parseExpression('js.configs.recommended');
			eslintConfigs.push(jsConfig);

			if (typescript) {
				const tsConfig = js.common.parseExpression('ts.configs.recommended');
				eslintConfigs.push(js.common.createSpread(tsConfig));
			}

			const svelteConfig = js.common.parseExpression('svelte.configs.recommended');
			eslintConfigs.push(js.common.createSpread(svelteConfig));

			const globalsBrowser = js.common.createSpread(js.common.parseExpression('globals.browser'));
			const globalsNode = js.common.createSpread(js.common.parseExpression('globals.node'));
			const globalsObjLiteral = js.object.create({});
			globalsObjLiteral.properties = [globalsBrowser, globalsNode];
			const rules = js.object.create({ '"no-undef"': 'off' });

			if (rules.properties[0].type !== 'Property') {
				throw new Error('rules.properties[0].type !== "Property"');
			}
			comments.add(rules.properties[0].key, {
				type: 'Line',
				value:
					' typescript-eslint strongly recommend that you do not use the no-undef lint rule on TypeScript projects.'
			});
			comments.add(rules.properties[0].key, {
				type: 'Line',
				value:
					' see: https://typescript-eslint.io/troubleshooting/faqs/eslint/#i-get-errors-from-the-no-undef-rule-about-global-variables-not-being-defined-even-though-there-are-no-typescript-errors'
			});

			const globalsConfig = js.object.create({
				languageOptions: {
					globals: globalsObjLiteral
				},
				rules: typescript ? rules : undefined
			});

			eslintConfigs.push(globalsConfig);

			if (typescript) {
				const svelteTSParserConfig = js.object.create({
					files: ['**/*.svelte', '**/*.svelte.ts', '**/*.svelte.js'],
					languageOptions: {
						parserOptions: {
							projectService: true,
							extraFileExtensions: ['.svelte'],
							parser: js.variables.createIdentifier('ts.parser'),
							svelteConfig: js.variables.createIdentifier('svelteConfig')
						}
					}
				});
				eslintConfigs.push(svelteTSParserConfig);
			} else {
				const svelteTSParserConfig = js.object.create({
					files: ['**/*.svelte', '**/*.svelte.js'],
					languageOptions: {
						parserOptions: {
							svelteConfig: js.variables.createIdentifier('svelteConfig')
						}
					}
				});
				eslintConfigs.push(svelteTSParserConfig);
			}

			let exportExpression: AstTypes.ArrayExpression | AstTypes.CallExpression;
			if (typescript) {
				const tsConfigCall = js.functions.createCall({ name: 'defineConfig', args: [] });
				tsConfigCall.arguments.push(...eslintConfigs);
				exportExpression = tsConfigCall;
			} else {
				const eslintArray = js.array.create();
				eslintConfigs.map((x) => js.array.append(eslintArray, x));
				exportExpression = eslintArray;
			}
			const { value: defaultExport, astNode } = js.exports.createDefault(ast, {
				fallback: exportExpression
			});
			// if it's not the config we created, then we'll leave it alone and exit out
			if (defaultExport !== exportExpression) {
				log.warn('An eslint config is already defined. Skipping initialization.');
				return content;
			}

			// type annotate config
			if (!typescript)
				js.common.addJsDocTypeComment(astNode, comments, {
					type: "import('eslint').Linter.Config[]"
				});

			if (typescript) js.imports.addDefault(ast, { from: 'typescript-eslint', as: 'ts' });
			js.imports.addDefault(ast, { from: 'globals', as: 'globals' });
			if (typescript)
				js.imports.addNamed(ast, { from: 'eslint/config', imports: ['defineConfig'] });
			js.imports.addDefault(ast, { from: 'eslint-plugin-svelte', as: 'svelte' });
			js.imports.addDefault(ast, { from: '@eslint/js', as: 'js' });
			js.imports.addNamed(ast, {
				from: '@eslint/compat',
				imports: ['includeIgnoreFile']
			});
			js.imports.addDefault(ast, { from: 'node:path', as: 'path' });

			return generateCode();
		});

		if (prettierInstalled) {
			sv.file(files.eslintConfig, addEslintConfigPrettier);
		}
	}
});
