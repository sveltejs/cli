import { describe, expect, it } from 'vitest';
import { addPlugin, getConfigObject, addToObjectArray } from '../tooling/helpers.ts';
import { parseScript } from '../tooling/parsers.ts';

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
	describe('addPlugin', () => {
		it('empty config', () => {
			expect(addPlugin(``)).toMatchInlineSnapshot(`
				"import { defineConfig } from 'vite';
				import devtoolsJson from 'vite-plugin-devtools-json';

				export default defineConfig({ plugins: [devtoolsJson()] });"
			`);
		});

		it('config_default', () => {
			expect(addPlugin(config_default)).toMatchInlineSnapshot(`
				"import devtoolsJson from 'vite-plugin-devtools-json';
				import { sveltekit } from '@sveltejs/kit/vite';
				import { defineConfig } from 'vite';

				export default defineConfig({
					plugins: [sveltekit(), devtoolsJson()]
				});"
			`);
		});

		it('config_w_variable', () => {
			expect(addPlugin(config_w_variable)).toMatchInlineSnapshot(`
				"import devtoolsJson from 'vite-plugin-devtools-json';
				import { sveltekit } from '@sveltejs/kit/vite';
				import { defineConfig } from 'vite';

				const config = defineConfig({
					plugins: [sveltekit(), devtoolsJson()]
				});

				export default config;"
			`);
		});

		it('config_wo_defineConfig', () => {
			expect(addPlugin(config_wo_defineConfig)).toMatchInlineSnapshot(`
				"import devtoolsJson from 'vite-plugin-devtools-json';
				import { sveltekit } from '@sveltejs/kit/vite';
				import type { UserConfig, defineConfig } from 'vite';

				const config: UserConfig = {
					plugins: [sveltekit(), devtoolsJson()]
				};

				export default config;"
			`);
		});
	});

	// Tests for getConfigObject helper
	describe('getConfigObject', () => {
		it('gets object from defineConfig wrapper', () => {
			const { ast } = parseScript(config_default);
			const configObject = getConfigObject(ast, { ignoreWrapper: 'defineConfig' });

			expect(configObject.type).toBe('ObjectExpression');
			expect(configObject.properties).toHaveLength(1);
		});

		it('gets object without wrapper', () => {
			const { ast } = parseScript(config_wo_defineConfig);
			const configObject = getConfigObject(ast);

			expect(configObject.type).toBe('ObjectExpression');
			expect(configObject.properties).toHaveLength(1);
		});

		it('creates fallback config when no export default exists', () => {
			const { ast } = parseScript(`import { someHelper } from './helper';`);
			const configObject = getConfigObject(ast, {
				fallback: 'defineConfig({ build: { target: "es2015" } })',
				ignoreWrapper: 'defineConfig'
			});

			expect(configObject.type).toBe('ObjectExpression');
		});
	});

	// Tests for addToObjectArray helper
	describe('addToObjectArray', () => {
		it('adds to existing array property', () => {
			const { ast, generateCode } = parseScript(config_default);
			const configObject = getConfigObject(ast, { ignoreWrapper: 'defineConfig' });

			addToObjectArray(configObject, {
				code: 'newPlugin()',
				arrayProperty: 'plugins',
				mode: 'append'
			});

			expect(generateCode()).toMatchInlineSnapshot(`
				"import { sveltekit } from '@sveltejs/kit/vite';
				import { defineConfig } from 'vite';

				export default defineConfig({
					plugins: [sveltekit(), newPlugin()]
				});"
			`);
		});

		it('creates new array property', () => {
			const { ast, generateCode } = parseScript(config_default);
			const configObject = getConfigObject(ast, { ignoreWrapper: 'defineConfig' });

			addToObjectArray(configObject, {
				code: 'eslint()',
				arrayProperty: 'tools',
				mode: 'append'
			});

			expect(generateCode()).toMatchInlineSnapshot(`
				"import { sveltekit } from '@sveltejs/kit/vite';
				import { defineConfig } from 'vite';

				export default defineConfig({
					plugins: [sveltekit()],
					tools: [eslint()]
				});"
			`);
		});

		it('prepends to array', () => {
			const { ast, generateCode } = parseScript(config_default);
			const configObject = getConfigObject(ast, { ignoreWrapper: 'defineConfig' });

			addToObjectArray(configObject, {
				code: 'firstPlugin()',
				arrayProperty: 'plugins',
				mode: 'prepend'
			});

			expect(generateCode()).toMatchInlineSnapshot(`
				"import { sveltekit } from '@sveltejs/kit/vite';
				import { defineConfig } from 'vite';

				export default defineConfig({
					plugins: [firstPlugin(), sveltekit()]
				});"
			`);
		});

		it('mode: append (default behavior)', () => {
			const { ast, generateCode } = parseScript(config_default);
			const configObject = getConfigObject(ast, { ignoreWrapper: 'defineConfig' });

			addToObjectArray(configObject, {
				code: 'newPlugin()',
				arrayProperty: 'plugins'
				// mode defaults to 'append'
			});

			expect(generateCode()).toMatchInlineSnapshot(`
				"import { sveltekit } from '@sveltejs/kit/vite';
				import { defineConfig } from 'vite';

				export default defineConfig({
					plugins: [sveltekit(), newPlugin()]
				});"
			`);
		});

		it('multiple items with different modes', () => {
			const { ast, generateCode } = parseScript(config_default);
			const configObject = getConfigObject(ast, { ignoreWrapper: 'defineConfig' });

			// Add to end first
			addToObjectArray(configObject, {
				code: 'lastPlugin()',
				arrayProperty: 'plugins',
				mode: 'append'
			});

			// Then add to beginning
			addToObjectArray(configObject, {
				code: 'firstPlugin()',
				arrayProperty: 'plugins',
				mode: 'prepend'
			});

			expect(generateCode()).toMatchInlineSnapshot(`
				"import { sveltekit } from '@sveltejs/kit/vite';
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
});
