import { dedent, defineAddon, log } from '@sveltejs/cli-core';
import { array, common, exports, functions, imports, object } from '@sveltejs/cli-core/js';
import { parseJson, parseScript } from '@sveltejs/cli-core/parsers';

export default defineAddon({
	id: 'vitest',
	homepage: 'https://vitest.dev',
	options: {},
	run: ({ sv, typescript, kit }) => {
		const ext = typescript ? 'ts' : 'js';

		sv.devDependency('vitest', '^2.0.4');

		sv.file('package.json', (content) => {
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
		});

		sv.file(`src/demo.spec.${ext}`, (content) => {
			if (content) return content;

			return dedent`
				import { describe, it, expect } from 'vitest';

				describe('sum test', () => {
					it('adds 1 + 2 to equal 3', () => {
						expect(1 + 2).toBe(3);
					});
				});
			`;
		});

		if (kit) {
			sv.devDependency('@testing-library/svelte', '^5.2.4');
			sv.devDependency('@testing-library/jest-dom', '^6.6.3');
			sv.devDependency('jsdom', '^25.0.1');

			sv.file(`${kit.routesDirectory}/page.svelte.test.${ext}`, (content) => {
				if (content) return content;

				return dedent`
					import { describe,test, expect } from 'vitest';
					import { render, screen } from '@testing-library/svelte';
					import Page from  './+page.svelte';

					describe('/+page.svelte',()=>{
						test('should render h1',()=>{
							render(Page);
							expect(screen.getByRole('heading',{level:1})).toBeInTheDocument();
						})
					})
				`;
			});

			sv.file('vitest-setup-client.ts', (content) => {
				if (content) return content;

				return dedent`
					import '@testing-library/jest-dom/vitest'

					// add global mocks here, i.e. for sveltekit '$app/stores'
				`;
			});

			sv.file('vitest.workspace.ts', (content) => {
				const { ast, generateCode } = parseScript(content);

				imports.addNamed(ast, 'vitest/config', { defineWorkspace: 'defineWorkspace' });
				imports.addNamed(ast, '@testing-library/svelte/vite', { svelteTesting: 'svelteTesting' });

				const clientObjectExpression = object.create({
					extends: common.createLiteral(`./vite.config.${ext}`),
					plugins: common.expressionFromString(
						'[svelteTesting({ resolveBrowser: true, autoCleanup: true })]'
					),
					test: object.create({
						name: common.createLiteral('client'),
						environment: common.createLiteral('jsdom'),
						clearMocks: common.expressionFromString('true'),
						include: common.expressionFromString("['src/**/*.svelte.{test,spec}.{js,ts}']"),
						exclude: common.expressionFromString("['src/lib/server/**']"),
						setupFiles: common.expressionFromString("['./vitest-setup-client.ts']")
					})
				});
				const serverObjectExpression = object.create({
					extends: common.createLiteral(`./vite.config.${ext}`),
					test: object.create({
						name: common.createLiteral('server'),
						environment: common.createLiteral('node'),
						include: common.expressionFromString("['src/**/*.{test,spec}.{js,ts}']"),
						exclude: common.expressionFromString("['src/**/*.svelte.{test,spec}.{js,ts}']")
					})
				});

				const defineWorkspaceFallback = functions.call('defineWorkspace', []);
				const { value: defineWorkspaceCall } = exports.defaultExport(ast, defineWorkspaceFallback);
				if (defineWorkspaceCall.type !== 'CallExpression') {
					log.warn('Unexpected vite config for vitest add-on. Could not update.');
				}

				const workspaceArray = functions.argumentByIndex(
					defineWorkspaceCall,
					0,
					array.createEmpty()
				);
				array.push(workspaceArray, clientObjectExpression);
				array.push(workspaceArray, serverObjectExpression);

				return generateCode();
			});
		} else {
			sv.file(`vite.config.${ext}`, (content) => {
				const { ast, generateCode } = parseScript(content);

				// find `defineConfig` import declaration for 'vite'
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

				// we'll need to replace the 'vite' import for a 'vitest/config' import.
				// if `defineConfig` is the only specifier in that 'vite' import, remove the entire import declaration
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
					// if the previous `defineConfig` was aliased, reuse the alias for the 'vitest/config' import
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
					log.warn('Unexpected vite config for vitest add-on. Could not update.');
				}

				return generateCode();
			});
		}
	}
});
