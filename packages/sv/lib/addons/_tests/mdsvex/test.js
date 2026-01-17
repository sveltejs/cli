/** @import { Fixtures } from '../../../testing.js' */

import fs from 'node:fs';
import path from 'node:path';
import { expect } from '@playwright/test';
import { js, svelte, parse } from '../../../core.js';
import { setupTest } from '../_setup/suite.js';
import { svxFile } from './fixtures.js';
import mdsvex from '../../mdsvex/index.js';

const { test, testCases, prepareServer } = setupTest(
	{ mdsvex },
	{ kinds: [{ type: 'default', options: { mdsvex: {} } }] }
);

test.concurrent.for(testCases)(
	'mdsvex $variant',
	async (testCase, /** @type {Fixtures & import('vitest').TestContext} */ ctx) => {
		const cwd = ctx.cwd(testCase);
		const page = ctx.page;

		// ...add test files
		addFixture(cwd, testCase.variant);

		const { close } = await prepareServer({ cwd, page });
		// kill server process when we're done
		ctx.onTestFinished(async () => await close());

		expect(page.locator('.mdsvex h1')).toBeTruthy();
		expect(page.locator('.mdsvex h2')).toBeTruthy();
		expect(page.locator('.mdsvex p')).toBeTruthy();
	}
);

/**
 * @param {string} cwd
 * @param {string} variant
 */
function addFixture(cwd, variant) {
	let page;
	let svx;
	if (variant.startsWith('kit')) {
		page = path.resolve(cwd, 'src', 'routes', '+page.svelte');
		svx = path.resolve(cwd, 'src', 'routes', 'Demo.svx');
	} else {
		page = path.resolve(cwd, 'src', 'App.svelte');
		svx = path.resolve(cwd, 'src', 'Demo.svx');
	}

	const src = fs.readFileSync(page, 'utf8');
	const { ast, generateCode } = parse.svelte(src);
	svelte.ensureScript(ast);
	if (!ast.instance) throw new Error('Expected instance script');
	js.imports.addDefault(ast.instance.content, { from: './Demo.svx', as: 'Demo' });

	svelte.addFragment(ast, '<div class="mdsvex"><Demo /></div>');

	const content = generateCode();

	fs.writeFileSync(page, content, 'utf8');
	fs.writeFileSync(svx, svxFile, 'utf8');
}
