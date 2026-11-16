import fs from 'node:fs';
import path from 'node:path';
import devtools from '../../devtools.ts';
import { setupTest } from '../_setup/suite.ts';

const { test, testCases } = setupTest(
	{ devtools },
	{
		kinds: [{ type: 'default', options: { devtools: {} } }],
		browser: false
	}
);

test.concurrent.for(testCases)('devtools $variant', (testCase, { expect, ...ctx }) => {
	const cwd = ctx.cwd(testCase);
	const language = testCase.variant.endsWith('-ts') ? 'ts' : 'js';
	const source = fs.readFileSync(path.join(cwd, `vite.config.${language}`), 'utf8');
	const pkg = JSON.parse(fs.readFileSync(path.join(cwd, 'package.json'), 'utf8'));

	expect(pkg.devDependencies).toHaveProperty('@vitejs/devtools', '^0.8.3');
	expect(pkg.devDependencies).toHaveProperty('@vitejs/devtools-vite', '^0.8.3');
	expect(pkg.devDependencies).not.toHaveProperty('@vitejs/devtools-vitest');
	expect(pkg.devDependencies).toHaveProperty('vite-devtools-svelte', '^0.7.0');
	expect(source).toContain(`import { DevTools } from '@vitejs/devtools'`);
	expect(source).toContain(`import { svelteDevtools } from 'vite-devtools-svelte'`);

	const svelteDevtoolsIndex = source.indexOf('svelteDevtools()');
	const devtoolsIndex = source.indexOf('DevTools()');
	const sveltePluginIndex = Math.max(source.indexOf('sveltekit('), source.indexOf('svelte()'));

	expect(svelteDevtoolsIndex).toBeGreaterThan(-1);
	expect(devtoolsIndex).toBeGreaterThan(svelteDevtoolsIndex);
	expect(sveltePluginIndex).toBeGreaterThan(devtoolsIndex);
});
