import { expect } from '@playwright/test';
import { js, svelte, parse } from '@sveltejs/sv-utils';
import fs from 'node:fs';
import path from 'node:path';
import mdsvex from '../../mdsvex.ts';
import { setupTest } from '../_setup/suite.ts';
import { svxFile } from './fixtures.ts';

const { test, testCases, prepareServer } = setupTest(
	{ mdsvex },
	{ kinds: [{ type: 'default', options: { mdsvex: {} } }] }
);

test.concurrent.for(testCases)('mdsvex $variant', async (testCase, { page, ...ctx }) => {
	const cwd = ctx.cwd(testCase);

	// ...add test files
	addFixture(cwd, testCase.variant);

	const { close } = await prepareServer({ cwd, page });
	// kill server process when we're done
	ctx.onTestFinished(async () => await close());

	expect(page.locator('.mdsvex h1')).toBeTruthy();
	expect(page.locator('.mdsvex h2')).toBeTruthy();
	expect(page.locator('.mdsvex p')).toBeTruthy();
});

function addFixture(cwd: string, variant: string) {
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
	js.imports.addDefault(ast.instance.content, { from: './Demo.svx', as: 'Demo' });

	svelte.addFragment(ast, '<div class="mdsvex"><Demo /></div>');

	const content = generateCode();

	fs.writeFileSync(page, content, 'utf8');
	fs.writeFileSync(svx, svxFile, 'utf8');
}
