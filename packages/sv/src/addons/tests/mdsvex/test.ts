import fs from 'node:fs';
import path from 'node:path';
import { expect } from '@playwright/test';
import { transforms } from '@sveltejs/sv-utils';
import mdsvex from '../../mdsvex.ts';
import { setupTest } from '../_setup/suite.ts';
import { svxFile } from './fixtures.ts';

const { test, testCases, prepareServer } = setupTest(
	{ mdsvex },
	{
		kinds: [
			{ type: 'default', options: { mdsvex: { plugins: [] } } },
			{
				type: 'plugins',
				options: { mdsvex: { plugins: ['callouts', 'figures', 'anchors', 'diagram'] } }
			}
		]
	}
);

test('configures the plugin prompt', ({ expect: vExpect }) => {
	vExpect(mdsvex.options.plugins.searchable).toBe(true);
	vExpect(mdsvex.options.plugins.default).toEqual([
		'page-data',
		'anchors',
		'toc',
		'figures',
		'code-blocks',
		'external-links'
	]);
	vExpect(mdsvex.options.plugins.options.map(({ value }) => value)).toEqual([
		'callouts',
		'elements',
		'steps',
		'tabs',
		'emoji',
		'code-blocks',
		'diagram',
		'embeds',
		'figures',
		'anchors',
		'toc',
		'external-links',
		'references',
		'citations',
		'numbering',
		'page-data',
		'link-check'
	]);
	vExpect(
		mdsvex.options.plugins.options
			.filter(({ label }) => label?.endsWith(' *'))
			.map(({ value }) => value)
	).toEqual(['code-blocks', 'figures', 'anchors', 'toc', 'external-links', 'page-data']);
});

test.concurrent.for(testCases)('mdsvex $kind.type $variant', async (testCase, { page, ...ctx }) => {
	const cwd = ctx.cwd(testCase);

	// ...add test files
	addFixture(cwd, testCase.variant);

	if (testCase.kind.type === 'plugins') {
		const viteConfigFile = fs.existsSync(path.join(cwd, 'vite.config.ts'))
			? 'vite.config.ts'
			: 'vite.config.js';
		const viteConfig = fs.readFileSync(path.join(cwd, viteConfigFile), 'utf8');
		const packageJson = fs.readFileSync(path.join(cwd, 'package.json'), 'utf8');
		expect(viteConfig).toContain('heading_ids: true');
		expect(viteConfig).toContain('unwrap_images: true');
		expect(viteConfig).toContain('plugins: [callouts(), diagram(), figures(), anchors()]');
		expect(packageJson).toContain('"@mdsvex/plugin-callouts": "next"');
		expect(packageJson).toContain('"mermaid": "^12.3.0"');
	}

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
	const result = addMarkup(src);
	if (result === false) {
		// markup already added
		return;
	}

	fs.writeFileSync(page, result, 'utf8');
	fs.writeFileSync(svx, svxFile, 'utf8');
}
