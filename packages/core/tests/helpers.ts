import { describe, expect, it } from 'vitest';
import { addPlugin } from '../tooling/helpers.ts';

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
});
