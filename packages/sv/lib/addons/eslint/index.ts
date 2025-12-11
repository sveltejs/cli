import { defineAddon, log, parseJson, parseScript, js, type AstTypes } from '../../core.ts';
import { addEslintConfigPrettier, getNodeTypesVersion } from '../common.ts';

export default defineAddon({
	id: 'eslint',
	shortDescription: 'linter',
	homepage: 'https://eslint.org',
	options: {},
	run: ({ sv, typescript, dependencyVersion, files }) => {
		const prettierInstalled = Boolean(dependencyVersion('prettier'));

		sv.devDependency('eslint', '^9.39.1');
		sv.devDependency('@eslint/compat', '^1.4.0');
		sv.devDependency('eslint-plugin-svelte', '^3.13.1');
		sv.devDependency('globals', '^16.5.0');
		sv.devDependency('@eslint/js', '^9.39.1');
		sv.devDependency('@types/node', getNodeTypesVersion());

		if (typescript) sv.devDependency('typescript-eslint', '^8.48.1');

		if (prettierInstalled) sv.devDependency('eslint-config-prettier', '^10.1.8');

		sv.file(files.package, (content) => {
			const { data, generateCode } = parseJson(content);
			data.scripts ??= {};
			const scripts: Record<string, string> = data.scripts;
			const LINT_CMD = 'eslint .';
			scripts['lint'] ??= LINT_CMD;
			if (!scripts['lint'].includes(LINT_CMD)) scripts['lint'] += ` && ${LINT_CMD}`;
			return generateCode();
		});

		sv.file(files.vscodeSettings, (content) => {
			if (!content) return content;

			const { data, generateCode } = parseJson(content);
			const validate: string[] | undefined = data['eslint.validate'];
			if (validate && !validate.includes('svelte')) {
				validate.push('svelte');
			}
			return generateCode();
		});

		sv.file(files.eslintConfig, (content) => {
			const { ast, comments, generateCode } = parseScript(content);

			const eslintConfigs: Array<AstTypes.Expression | AstTypes.SpreadElement> = [];
			js.imports.addDefault(ast, { from: './svelte.config.js', as: 'svelteConfig' });
			const gitIgnorePathStatement = js.common.parseStatement(
				"\nconst gitignorePath = fileURLToPath(new URL('./.gitignore', import.meta.url));"
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
			js.imports.addNamed(ast, { from: 'node:url', imports: ['fileURLToPath'] });

			return generateCode();
		});

		if (prettierInstalled) {
			sv.file(files.eslintConfig, addEslintConfigPrettier);
		}
	}
});
