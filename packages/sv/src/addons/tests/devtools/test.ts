import fs from 'node:fs';
import path from 'node:path';
import { isVersionUnsupportedBelow, minVersion } from '@sveltejs/sv-utils';
import devtools, { plugins } from '../../devtools.ts';
import { setupTest } from '../_setup/suite.ts';

const { test, testCases } = setupTest(
	{ devtools },
	{
		kinds: [
			{ type: 'default', options: { devtools: {} } },
			{
				type: 'oxc-only',
				options: {
					devtools: { plugins: ['oxc'] }
				}
			}
		],
		browser: false
	}
);

test.concurrent.for(testCases)('devtools $variant', (testCase, { expect, ...ctx }) => {
	const cwd = ctx.cwd(testCase);
	const language = testCase.variant.endsWith('-ts') ? 'ts' : 'js';
	const source = fs.readFileSync(path.join(cwd, `vite.config.${language}`), 'utf8');
	const pkg = JSON.parse(fs.readFileSync(path.join(cwd, 'package.json'), 'utf8'));

	expect(pkg.devDependencies).toHaveProperty('@vitejs/devtools', '^0.8.3');
	expect(pkg.devDependencies).toHaveProperty('@sveltejs/vite-devtools-svelte', '^0.11.0');
	for (const plugin of plugins) {
		const selected = testCase.kind.type === 'default' ? plugin.preselected : plugin.id === 'oxc';
		const assertion = expect(pkg.devDependencies);
		if (selected) assertion.toHaveProperty(plugin.package, plugin.version);
		else assertion.not.toHaveProperty(plugin.package);
	}

	// host projects are bumped to the devtools requirements:
	// https://github.com/sveltejs/vite-devtools-svelte#requirements
	const isKit = testCase.variant.startsWith('kit');
	const requirements: Array<[string, string]> = [
		['vite', '8.3.5'],
		['svelte', '5.46.4']
	];
	if (isKit) requirements.push(['@sveltejs/kit', '3.3.0']);
	for (const [name, required] of requirements) {
		const range = pkg.devDependencies[name];
		expect(range, `expected '${name}' to be declared`).toBeDefined();
		expect(
			isVersionUnsupportedBelow(minVersion(range), required),
			`'${name}': '${range}' does not satisfy >= ${required}`
		).toBe(false);
	}
	if (!isKit) {
		expect(pkg.devDependencies).not.toHaveProperty('@sveltejs/kit');
	}
	expect(source).not.toContain(`import { DevTools } from '@vitejs/devtools'`);
	expect(source).toContain(`import { svelteDevtools } from '@sveltejs/vite-devtools-svelte'`);
	expect(source).toMatch(/devtools:\s*\{\s*apply:\s*'serve',\s*clientAuth:\s*true\s*\}/);

	const svelteDevtoolsIndex = source.indexOf('svelteDevtools()');
	const sveltePluginIndex = Math.max(source.indexOf('sveltekit('), source.indexOf('svelte()'));

	expect(svelteDevtoolsIndex).toBeGreaterThan(-1);
	expect(source).not.toContain('DevTools()');
	expect(sveltePluginIndex).toBeGreaterThan(svelteDevtoolsIndex);
});
