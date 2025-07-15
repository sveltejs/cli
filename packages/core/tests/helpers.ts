import { describe, expect, it } from 'vitest';
import { addPlugin, addToConfigArray } from '../tooling/helpers.ts';
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
			import type { UserConfig } from 'vite';

			const config: UserConfig = {
				plugins: [sveltekit(), devtoolsJson()]
			};

			export default config;"
		`);
	});

	// Tests for addToConfigArray helper
	describe('addToConfigArray', () => {
		it('add to custom array property', () => {
			const { ast, generateCode } = parseScript(config_default);

			addToConfigArray(ast, {
				code: 'eslint()',
				arrayProperty: 'tools', // Different property name
				ignoreWrapper: 'defineConfig'
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

		it('add to plugins without defineConfig', () => {
			const { ast, generateCode } = parseScript(config_wo_defineConfig);

			addToConfigArray(ast, {
				code: 'eslint()',
				arrayProperty: 'plugins'
				// No ignoreWrapper, so it treats the object directly
			});

			expect(generateCode()).toMatchInlineSnapshot(`
				"import { sveltekit } from '@sveltejs/kit/vite';
				import type { UserConfig } from 'vite';

				const config: UserConfig = { plugins: [sveltekit(), eslint()] };

				export default config;"
			`);
		});

		it('add with function arguments', () => {
			const { ast, generateCode } = parseScript(config_default);

			addToConfigArray(ast, {
				code: `somePlugin('arg1', 'arg2')`,
				arrayProperty: 'plugins',
				ignoreWrapper: 'defineConfig'
			});

			expect(generateCode()).toMatchInlineSnapshot(`
				"import { sveltekit } from '@sveltejs/kit/vite';
				import { defineConfig } from 'vite';

				export default defineConfig({
					plugins: [
						sveltekit(),
						somePlugin('arg1', 'arg2')
					]
				});"
			`);
		});

		it('add complex expression', () => {
			const { ast, generateCode } = parseScript(config_default);

			addToConfigArray(ast, {
				code: `condition ? plugin1() : plugin2({ option: 'value' })`,
				arrayProperty: 'plugins',
				ignoreWrapper: 'defineConfig'
			});

			expect(generateCode()).toMatchInlineSnapshot(`
				"import { sveltekit } from '@sveltejs/kit/vite';
				import { defineConfig } from 'vite';

				export default defineConfig({
					plugins: [
						sveltekit(),
						condition ? plugin1() : plugin2({ option: 'value' })
					]
				});"
			`);
		});
	});
});
