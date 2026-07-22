import { expect } from '@playwright/test';
import { transforms } from '@sveltejs/sv-utils';
import fs from 'node:fs';
import path from 'node:path';
import mdsvex from '../../mdsvex.ts';
import { setupTest } from '../_setup/suite.ts';
import { svxFile } from './fixtures.ts';

const { test, testCases, prepareServer } = setupTest(
	{ mdsvex },
	{ kinds: [{ type: 'default', options: { mdsvex: { extensions: ['.svx', '.md'] } } }] }
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

const addMarkup = transforms.svelteScript({ language: 'js' }, ({ ast, svelte, js }) => {
	const alreadyAdded = ast.fragment.nodes.some(
		(node) =>
			node.type === 'RegularElement' &&
			node.attributes.some(
				(attr) =>
					attr.type === 'Attribute' &&
					attr.name === 'class' &&
					Array.isArray(attr.value) &&
					attr.value.some((v) => v.type === 'Text' && v.data === 'mdsvex')
			)
	);
	if (alreadyAdded) return false;

	js.imports.addDefault(ast.instance.content, { from: './Demo.svx', as: 'Demo' });
	svelte.addFragment(ast, '<div class="mdsvex"><Demo /></div>');
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
	fs.writeFileSync(page, addMarkup(src), 'utf8');
	fs.writeFileSync(svx, svxFile, 'utf8');
}
