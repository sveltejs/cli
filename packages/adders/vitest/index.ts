import { dedent, defineAdder, log } from '@sveltejs/cli-core';
import { common, exports, imports, object } from '@sveltejs/cli-core/js';
import { parseJson, parseScript } from '@sveltejs/cli-core/parsers';

export default defineAdder({
	id: 'vitest',
	environments: { svelte: true, kit: true },
	homepage: 'https://vitest.dev',
	options: {},
	packages: [{ name: 'vitest', version: '^2.0.4', dev: true }],
	files: [
		{
			name: () => 'package.json',
			content: ({ content }) => {
				const { data, generateCode } = parseJson(content);
				data.scripts ??= {};
				const scripts: Record<string, string> = data.scripts;
				const TEST_CMD = 'vitest';
				// we use `--run` so that vitest doesn't run in watch mode when running `npm run test`
				const RUN_TEST = 'npm run test:unit -- --run';
				scripts['test:unit'] ??= TEST_CMD;
				scripts['test'] ??= RUN_TEST;
				if (!scripts['test'].includes(RUN_TEST)) scripts['test'] += ` && ${RUN_TEST}`;
				return generateCode();
			}
		},
		{
			name: ({ typescript }) => `src/demo.spec.${typescript ? 'ts' : 'js'}`,
			content: ({ content }) => {
				if (content) return content;

				return dedent`
					import { describe, it, expect } from 'vitest';

					describe('sum test', () => {
						it('adds 1 + 2 to equal 3', () => {
							expect(1 + 2).toBe(3);
						});
					});
					`;
			}
		},
		{
			name: ({ typescript }) => `vite.config.${typescript ? 'ts' : 'js'}`,
			content: ({ content }) => {
				const { ast, generateCode } = parseScript(content);

				// find `defineConfig` import declaration for "vite"
				const importDecls = ast.body.filter((n) => n.type === 'ImportDeclaration');
				const defineConfigImportDecl = importDecls.find(
					(importDecl) =>
						(importDecl.source.value === 'vite' || importDecl.source.value === 'vitest/config') &&
						importDecl.importKind === 'value' &&
						importDecl.specifiers?.some(
							(specifier) =>
								specifier.type === 'ImportSpecifier' && specifier.imported.name === 'defineConfig'
						)
				);

				// we'll need to replace the "vite" import for a "vitest/config" import.
				// if `defineConfig` is the only specifier in that "vite" import, remove the entire import declaration
				if (defineConfigImportDecl?.specifiers?.length === 1) {
					const idxToRemove = ast.body.indexOf(defineConfigImportDecl);
					ast.body.splice(idxToRemove, 1);
				} else {
					// otherwise, just remove the `defineConfig` specifier
					const idxToRemove = defineConfigImportDecl?.specifiers?.findIndex(
						(s) => s.type === 'ImportSpecifier' && s.imported.name === 'defineConfig'
					);
					if (idxToRemove) defineConfigImportDecl?.specifiers?.splice(idxToRemove, 1);
				}

				const config = common.expressionFromString('defineConfig({})');
				const defaultExport = exports.defaultExport(ast, config);

				const test = object.create({
					include: common.expressionFromString("['src/**/*.{test,spec}.{js,ts}']")
				});

				// uses the `defineConfig` helper
				if (
					defaultExport.value.type === 'CallExpression' &&
					defaultExport.value.arguments[0]?.type === 'ObjectExpression'
				) {
					// if the previous `defineConfig` was aliased, reuse the alias for the "vitest/config" import
					const importSpecifier = defineConfigImportDecl?.specifiers?.find(
						(sp) => sp.type === 'ImportSpecifier' && sp.imported.name === 'defineConfig'
					);
					const defineConfigAlias = (importSpecifier?.local?.name ?? 'defineConfig') as string;
					imports.addNamed(ast, 'vitest/config', { defineConfig: defineConfigAlias });

					object.properties(defaultExport.value.arguments[0], { test });
				} else if (defaultExport.value.type === 'ObjectExpression') {
					// if the config is just an object expression, just add the property
					object.properties(defaultExport.value, { test });
				} else {
					// unexpected config shape
					log.warn('Unexpected vite config for vitest adder. Could not update.');
				}

				return generateCode();
			}
		}
	]
});
