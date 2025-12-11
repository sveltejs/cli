import { defineAddon, log } from '../../core.ts';
import {
	array,
	common,
	exports,
	functions,
	imports,
	object,
	variables,
	type AstTypes
} from '../../core/tooling/js/index.ts';
import { parseJson, parseScript } from '../../core/tooling/parsers.ts';
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
			imports.addDefault(ast, { from: './svelte.config.js', as: 'svelteConfig' });
			const gitIgnorePathStatement = common.parseStatement(
				"\nconst gitignorePath = fileURLToPath(new URL('./.gitignore', import.meta.url));"
			);
			common.appendStatement(ast, { statement: gitIgnorePathStatement });

			const ignoresConfig = common.parseExpression('includeIgnoreFile(gitignorePath)');
			eslintConfigs.push(ignoresConfig);

			const jsConfig = common.parseExpression('js.configs.recommended');
			eslintConfigs.push(jsConfig);

			if (typescript) {
				const tsConfig = common.parseExpression('ts.configs.recommended');
				eslintConfigs.push(common.createSpread(tsConfig));
			}

			const svelteConfig = common.parseExpression('svelte.configs.recommended');
			eslintConfigs.push(common.createSpread(svelteConfig));

			const globalsBrowser = common.createSpread(common.parseExpression('globals.browser'));
			const globalsNode = common.createSpread(common.parseExpression('globals.node'));
			const globalsObjLiteral = object.create({});
			globalsObjLiteral.properties = [globalsBrowser, globalsNode];
			const rules = object.create({ '"no-undef"': 'off' });

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

			const globalsConfig = object.create({
				languageOptions: {
					globals: globalsObjLiteral
				},
				rules: typescript ? rules : undefined
			});

			eslintConfigs.push(globalsConfig);

			if (typescript) {
				const svelteTSParserConfig = object.create({
					files: ['**/*.svelte', '**/*.svelte.ts', '**/*.svelte.js'],
					languageOptions: {
						parserOptions: {
							projectService: true,
							extraFileExtensions: ['.svelte'],
							parser: variables.createIdentifier('ts.parser'),
							svelteConfig: variables.createIdentifier('svelteConfig')
						}
					}
				});
				eslintConfigs.push(svelteTSParserConfig);
			} else {
				const svelteTSParserConfig = object.create({
					files: ['**/*.svelte', '**/*.svelte.js'],
					languageOptions: {
						parserOptions: {
							svelteConfig: variables.createIdentifier('svelteConfig')
						}
					}
				});
				eslintConfigs.push(svelteTSParserConfig);
			}

			let exportExpression: AstTypes.ArrayExpression | AstTypes.CallExpression;
			if (typescript) {
				const tsConfigCall = functions.createCall({ name: 'defineConfig', args: [] });
				tsConfigCall.arguments.push(...eslintConfigs);
				exportExpression = tsConfigCall;
			} else {
				const eslintArray = array.create();
				eslintConfigs.map((x) => array.append(eslintArray, x));
				exportExpression = eslintArray;
			}
			const { value: defaultExport, astNode } = exports.createDefault(ast, {
				fallback: exportExpression
			});
			// if it's not the config we created, then we'll leave it alone and exit out
			if (defaultExport !== exportExpression) {
				log.warn('An eslint config is already defined. Skipping initialization.');
				return content;
			}

			// type annotate config
			if (!typescript)
				common.addJsDocTypeComment(astNode, comments, {
					type: "import('eslint').Linter.Config[]"
				});

			if (typescript) imports.addDefault(ast, { from: 'typescript-eslint', as: 'ts' });
			imports.addDefault(ast, { from: 'globals', as: 'globals' });
			if (typescript) imports.addNamed(ast, { from: 'eslint/config', imports: ['defineConfig'] });
			imports.addDefault(ast, { from: 'eslint-plugin-svelte', as: 'svelte' });
			imports.addDefault(ast, { from: '@eslint/js', as: 'js' });
			imports.addNamed(ast, {
				from: '@eslint/compat',
				imports: ['includeIgnoreFile']
			});
			imports.addNamed(ast, { from: 'node:url', imports: ['fileURLToPath'] });

			return generateCode();
		});

		if (prettierInstalled) {
			sv.file(files.eslintConfig, addEslintConfigPrettier);
		}
	}
});
