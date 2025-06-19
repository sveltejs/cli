import fs from 'node:fs';
import path from 'node:path';
import { expect } from '@playwright/test';
import { parseSvelte } from '@sveltejs/cli-core/parsers';
import { imports } from '@sveltejs/cli-core/js';
import * as html from '@sveltejs/cli-core/html';
import { setupTest } from '../_setup/suite.ts';
import { svxFile } from './fixtures.ts';
import mdsvex from '../../mdsvex/index.ts';

const { test, variants, prepareServer } = setupTest({ mdsvex });

test.concurrent.for(variants)('core - %s', async (variant, { page, ...ctx }) => {
	const cwd = await ctx.run(variant, { mdsvex: {} });

	// ...add test files
	addFixture(cwd, variant);

	const { close } = await prepareServer({ cwd, page });
	// kill server process when we're done
	ctx.onTestFinished(async () => await close());

	expect(await page.$('.mdsvex h1')).toBeTruthy();
	expect(await page.$('.mdsvex h2')).toBeTruthy();
	expect(await page.$('.mdsvex p')).toBeTruthy();
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

	const div = html.div({ class: 'mdsvex' });
	html.appendElement(template.ast.childNodes, div);
	const mdsvexNode = html.element('Demo');
	html.appendElement(div.childNodes, mdsvexNode);

	const content = generateCode({
		script: script.generateCode(),
		template: template.generateCode()
	});

	fs.writeFileSync(page, content, 'utf8');
	fs.writeFileSync(svx, svxFile, 'utf8');
}
