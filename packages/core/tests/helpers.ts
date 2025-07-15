import { describe, expect, it } from 'vitest';
import {
	addPluginToViteConfig,
	exportDefaultConfig,
	addInArrayOfObject
} from '../tooling/helpers.ts';
import { parseScript } from '../tooling/parsers.ts';
import { imports } from '../dist/js.js';

const config_default = `
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [sveltekit()]
});
`;

const config_w_variable = `
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

const config = defineConfig({
	plugins: [sveltekit()]
});

export default config;
`;

const config_wo_defineConfig = `
import { sveltekit } from '@sveltejs/kit/vite';
import type { UserConfig } from 'vite';

const config: UserConfig = {
	plugins: [sveltekit()]
};

export default config;
`;

describe('helpers', () => {
	describe('getConfigObject', () => {
		it('gets object from defineConfig wrapper', () => {
			const { ast } = parseScript(config_default);
			const configObject = exportDefaultConfig(ast, { ignoreWrapper: 'defineConfig' });

			expect(configObject.type).toBe('ObjectExpression');
			expect(configObject.properties).toHaveLength(1);
		});

		it('gets object without wrapper', () => {
			const { ast } = parseScript(config_wo_defineConfig);
			const configObject = exportDefaultConfig(ast);

			expect(configObject.type).toBe('ObjectExpression');
			expect(configObject.properties).toHaveLength(1);
		});

		it('creates fallback config when no export default exists', () => {
			const { ast } = parseScript(`import { someHelper } from './helper';`);
			const configObject = exportDefaultConfig(ast, {
				fallback: 'defineConfig({ build: { target: "es2015" } })',
				ignoreWrapper: 'defineConfig'
			});

			expect(configObject.type).toBe('ObjectExpression');
			expect(configObject.properties).toHaveLength(1);
		});
	});

	describe('addToObjectArray', () => {
		it('adds to existing array property', () => {
			const { ast, generateCode } = parseScript(config_default);
			const configObject = exportDefaultConfig(ast, { ignoreWrapper: 'defineConfig' });

			imports.addDefault(ast, { from: 'my-best-plugin', as: 'newPlugin' });
			addInArrayOfObject(configObject, {
				code: 'newPlugin({ hello: "world" })',
				property: 'plugins',
				mode: 'append'
			});

			expect(generateCode()).toMatchInlineSnapshot(`
				"import newPlugin from 'my-best-plugin';
				import { sveltekit } from '@sveltejs/kit/vite';
				import { defineConfig } from 'vite';

				export default defineConfig({
					plugins: [
						sveltekit(),
						newPlugin({ hello: 'world' })
					]
				});"
			`);
		});

		it('creates new array property', () => {
			const { ast, generateCode } = parseScript(config_default);
			const configObject = exportDefaultConfig(ast, { ignoreWrapper: 'defineConfig' });

			imports.addDefault(ast, { from: 'eslint', as: 'eslint' });
			addInArrayOfObject(configObject, {
				code: 'eslint()',
				property: 'tools',
				mode: 'append'
			});

			expect(generateCode()).toMatchInlineSnapshot(`
				"import eslint from 'eslint';
				import { sveltekit } from '@sveltejs/kit/vite';
				import { defineConfig } from 'vite';

				export default defineConfig({
					plugins: [sveltekit()],
					tools: [eslint()]
				});"
			`);
		});

		it('prepends to array', () => {
			const { ast, generateCode } = parseScript(config_default);
			const configObject = exportDefaultConfig(ast, { ignoreWrapper: 'defineConfig' });

			imports.addDefault(ast, { from: 'firstPlugin', as: 'firstPlugin' });
			addInArrayOfObject(configObject, {
				code: 'firstPlugin()',
				property: 'plugins',
				mode: 'prepend'
			});

			expect(generateCode()).toMatchInlineSnapshot(`
				"import firstPlugin from 'firstPlugin';
				import { sveltekit } from '@sveltejs/kit/vite';
				import { defineConfig } from 'vite';

				export default defineConfig({
					plugins: [firstPlugin(), sveltekit()]
				});"
			`);
		});

		it('multiple items with different modes', () => {
			const { ast, generateCode } = parseScript(config_default);
			const configObject = exportDefaultConfig(ast, { ignoreWrapper: 'defineConfig' });

			// Add to end first
			imports.addDefault(ast, { from: 'lastPlugin', as: 'lastPlugin' });
			addInArrayOfObject(configObject, {
				code: 'lastPlugin()',
				property: 'plugins',
				mode: 'append'
			});

			// Then add to beginning
			imports.addDefault(ast, { from: 'firstPlugin', as: 'firstPlugin' });
			addInArrayOfObject(configObject, {
				code: 'firstPlugin()',
				property: 'plugins',
				mode: 'prepend'
			});

			expect(generateCode()).toMatchInlineSnapshot(`
				"import firstPlugin from 'firstPlugin';
				import lastPlugin from 'lastPlugin';
				import { sveltekit } from '@sveltejs/kit/vite';
				import { defineConfig } from 'vite';

				export default defineConfig({
					plugins: [
						firstPlugin(),
						sveltekit(),
						lastPlugin()
					]
				});"
			`);
		});
	});

	describe('addPluginToViteConfig', () => {
		const addTestPlugin = (content: string) =>
			addPluginToViteConfig(content, (ast, configObject) => {
				const vitePluginName = 'bestPlugin';
				imports.addDefault(ast, { from: 'my-best-plugin', as: vitePluginName });

				addInArrayOfObject(configObject, {
					property: 'plugins',
					code: `${vitePluginName}()`
				});
			});

		it('empty config', () => {
			expect(addTestPlugin(``)).toMatchInlineSnapshot(`
				"import bestPlugin from 'my-best-plugin';
				import { defineConfig } from 'vite';

				export default defineConfig({ plugins: [bestPlugin()] });"
			`);
		});

		it('config_default', () => {
			expect(addTestPlugin(config_default)).toMatchInlineSnapshot(`
				"import bestPlugin from 'my-best-plugin';
				import { sveltekit } from '@sveltejs/kit/vite';
				import { defineConfig } from 'vite';

				export default defineConfig({
					plugins: [sveltekit(), bestPlugin()]
				});"
			`);
		});

		it('config_w_variable', () => {
			expect(addTestPlugin(config_w_variable)).toMatchInlineSnapshot(`
				"import bestPlugin from 'my-best-plugin';
				import { sveltekit } from '@sveltejs/kit/vite';
				import { defineConfig } from 'vite';

				const config = defineConfig({
					plugins: [sveltekit(), bestPlugin()]
				});

				export default config;"
			`);
		});

		it('config_wo_defineConfig', () => {
			expect(addTestPlugin(config_wo_defineConfig)).toMatchInlineSnapshot(`
				"import bestPlugin from 'my-best-plugin';
				import { sveltekit } from '@sveltejs/kit/vite';
				import type { UserConfig, defineConfig } from 'vite';

				const config: UserConfig = {
					plugins: [sveltekit(), bestPlugin()]
				};

				export default config;"
			`);
		});
	});
});
