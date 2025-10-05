import fs from 'node:fs';
import path from 'node:path';
import { expect } from '@playwright/test';
import { parseSvelte } from '@sveltejs/cli-core/parsers';
import { imports } from '@sveltejs/cli-core/js';
import * as html from '@sveltejs/cli-core/html';
import { setupTest } from '../_setup/suite.ts';
import { svxFile } from './fixtures.ts';
import mdsvex from '../../mdsvex/index.ts';

const { test, testCases, prepareServer } = setupTest(
	{ mdsvex },
	{ kinds: [{ type: 'default', options: { mdsvex: {} } }] }
);

test.concurrent.for(testCases)('mdsvex $variant', async (testCase, { page, ...ctx }) => {
	const cwd = ctx.run(testCase);

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
	const { script, template, generateCode } = parseSvelte(src);
	imports.addDefault(script.ast, { from: './Demo.svx', as: 'Demo' });

	const div = html.createDiv({ class: 'mdsvex' });
	html.appendElement(template.ast.childNodes, div);
	const mdsvexNode = html.createElement('Demo');
	html.appendElement(div.childNodes, mdsvexNode);

	const content = generateCode({
		script: script.generateCode(),
		template: template.generateCode()
	});

	fs.writeFileSync(page, content, 'utf8');
	fs.writeFileSync(svx, svxFile, 'utf8');
}
