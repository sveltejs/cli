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
			},
			{
				type: 'prettier',
				options: { mdsvex: { plugins: [] } }
			}
		],
		filter: (addonTestCase) =>
			addonTestCase.kind.type !== 'prettier' || addonTestCase.variant === 'vite-js',
		preAdd: ({ addonTestCase, cwd }) => {
			if (addonTestCase.kind.type !== 'prettier') return;

			const packageJsonPath = path.resolve(cwd, 'package.json');
			const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
			packageJson.devDependencies ??= {};
			packageJson.devDependencies.prettier = '^3.8.3';
			fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson), 'utf8');
			fs.writeFileSync(
				path.resolve(cwd, 'prettier.config.js'),
				"export default { plugins: ['prettier-plugin-svelte', 'prettier-plugin-tailwindcss'] };\n",
				'utf8'
			);
		}
	}
);

test('configures the plugin prompt', ({ expect: vExpect }) => {
	vExpect(mdsvex.options.plugins.searchable).toBe(true);
	vExpect(mdsvex.options.plugins.default).toEqual([
		'anchors',
		'code-blocks',
		'external-links',
		'figures',
		'page-data',
		'toc'
	]);
	vExpect(mdsvex.options.plugins.options.map(({ value }) => value)).toEqual([
		'anchors',
		'code-blocks',
		'external-links',
		'figures',
		'page-data',
		'toc',
		'callouts',
		'citations',
		'diagram',
		'elements',
		'embeds',
		'emoji',
		'link-check',
		'numbering',
		'references',
		'steps',
		'tabs'
	]);
	vExpect(mdsvex.options.plugins.options.map(({ label }) => label)).toEqual(
		mdsvex.options.plugins.options.map(({ value }) => value)
	);
	vExpect(mdsvex.nextSteps?.({} as never).join('\n')).toContain(
		'https://marketplace.visualstudio.com/items?itemName=mdsvex.vscode-pfm'
	);
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
		expect(packageJson).toContain('"@mdsvex/plugin-callouts": "^0.1.0"');
		expect(packageJson).toContain('"mermaid": "^12.3.0"');
	}

	const vscodeExtensions = JSON.parse(
		fs.readFileSync(path.join(cwd, '.vscode', 'extensions.json'), 'utf8')
	);
	expect(vscodeExtensions.recommendations).toContain('mdsvex.vscode-pfm');

	if (testCase.kind.type === 'prettier') {
		const packageJson = fs.readFileSync(path.join(cwd, 'package.json'), 'utf8');
		const prettierConfig = fs.readFileSync(path.join(cwd, 'prettier.config.js'), 'utf8');
		expect(packageJson).toContain('"@mdsvex/prettier-plugin": "^0.1.0"');
		expect(prettierConfig).toContain("'@mdsvex/prettier-plugin'");
		expect(prettierConfig.indexOf("'@mdsvex/prettier-plugin'")).toBeLessThan(
			prettierConfig.indexOf("'prettier-plugin-tailwindcss'")
		);
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
