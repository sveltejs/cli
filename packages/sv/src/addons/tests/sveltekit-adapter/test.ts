import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect } from 'vitest';
import sveltekitAdapter from '../../sveltekit-adapter.ts';
import { setupTest } from '../_setup/suite.ts';

const addonId = sveltekitAdapter.id;
const { test, testCases } = setupTest(
	{ [addonId]: sveltekitAdapter },
	{
		kinds: [
			{ type: 'node', options: { [addonId]: { adapter: 'node' } } },
			{ type: 'auto', options: { [addonId]: { adapter: 'auto' } } },
			{
				type: 'cloudflare-workers',
				options: { [addonId]: { adapter: 'cloudflare', cfTarget: 'workers' } }
			},
			{
				type: 'cloudflare-pages',
				options: { [addonId]: { adapter: 'cloudflare', cfTarget: 'pages' } }
			},
			{
				// a project that already declared the Workers-only adapter v9
				type: 'cloudflare-pages-rollback',
				options: { [addonId]: { adapter: 'cloudflare', cfTarget: 'pages' } }
			},
			{
				// a wrangler config left over from a previous CLI run (v8-era Workers
				// fields plus Pages fields) being switched to Workers
				type: 'cloudflare-workers-migrate',
				options: { [addonId]: { adapter: 'cloudflare', cfTarget: 'workers' } }
			},
			{
				// same config being switched to Pages
				type: 'cloudflare-pages-migrate',
				options: { [addonId]: { adapter: 'cloudflare', cfTarget: 'pages' } }
			}
		],
		filter: (addonTestCase) => addonTestCase.variant.includes('kit'),
		browser: false,
		preAdd: ({ addonTestCase, cwd }) => {
			const type = addonTestCase.kind.type;

			if (type === 'cloudflare-pages-rollback') {
				const pkgPath = join(cwd, 'package.json');
				const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
				pkg.devDependencies ??= {};
				pkg.devDependencies['@sveltejs/adapter-cloudflare'] = '^9.0.0';
				writeFileSync(pkgPath, JSON.stringify(pkg, null, '\t'));
			}

			if (type === 'cloudflare-workers-migrate' || type === 'cloudflare-pages-migrate') {
				writeFileSync(
					join(cwd, 'wrangler.jsonc'),
					JSON.stringify(
						{
							name: 'test',
							compatibility_date: '2025-01-01',
							main: '.svelte-kit/cloudflare/_worker.js',
							assets: { binding: 'ASSETS', directory: '.svelte-kit/cloudflare' },
							pages_build_output_dir: '.svelte-kit/cloudflare',
							workers_dev: false,
							preview_urls: false
						},
						null,
						'\t'
					)
				);
			}
		}
	}
);

test.concurrent.for(testCases)('adapter $kind.type $variant', (testCase, { ...ctx }) => {
	const cwd = ctx.cwd(testCase);

	// config lives in vite.config.ts (ts) or vite.config.js (js)
	const viteConfig = ['vite.config.ts', 'vite.config.js']
		.map((name) => join(cwd, name))
		.find((file) => existsSync(file))!;

	const readme = join(cwd, 'README.md');
	if (existsSync(readme)) {
		const hasHint = readFileSync(readme, 'utf8').includes('/docs/kit/adapters');
		expect(hasHint).toBe(testCase.kind.type === 'auto');
	}

	const readPackageJson = () => JSON.parse(readFileSync(join(cwd, 'package.json'), 'utf8'));
	const readWrangler = () => readFileSync(join(cwd, 'wrangler.jsonc'), 'utf8');

	if (testCase.kind.type === 'node') {
		expect(readFileSync(viteConfig, 'utf8')).not.toMatch('adapter-auto');
		expect(readFileSync(viteConfig, 'utf8')).not.toMatch(
			'adapter-auto only supports some environments'
		);
	} else if (testCase.kind.type === 'auto') {
		expect(readFileSync(viteConfig, 'utf8')).toMatch('adapter-auto');
		expect(readFileSync(viteConfig, 'utf8')).toMatch(
			'adapter-auto only supports some environments'
		);
	} else if (testCase.kind.type === 'cloudflare-workers') {
		const wrangler = readWrangler();
		expect(wrangler).toMatch('"workers_dev": true');
		expect(wrangler).not.toMatch('"main"');
		expect(wrangler).not.toMatch('"assets"');
		expect(wrangler).not.toMatch('pages_build_output_dir');

		const pkg = readPackageJson();
		expect(pkg.devDependencies['@sveltejs/adapter-cloudflare']).toBe('^9.0.0');
		expect(pkg.devDependencies.wrangler).toBe('^4.162.0');
		expect(pkg.scripts.preview).toBe('vite build && wrangler dev --port 4173');
	} else if (testCase.kind.type === 'cloudflare-pages') {
		const wrangler = readWrangler();
		expect(wrangler).toMatch('pages_build_output_dir');
		expect(wrangler).not.toMatch('"main"');

		const pkg = readPackageJson();
		expect(pkg.devDependencies['@sveltejs/adapter-cloudflare']).toBe('^8.0.2');
		expect(pkg.scripts.preview).toBe('wrangler pages dev .svelte-kit/cloudflare --port 4173');
	} else if (testCase.kind.type === 'cloudflare-pages-rollback') {
		expect(readPackageJson().devDependencies['@sveltejs/adapter-cloudflare']).toBe('^8.0.2');
		expect(readWrangler()).toMatch('pages_build_output_dir');
	} else if (testCase.kind.type === 'cloudflare-workers-migrate') {
		const wrangler = readWrangler();
		expect(wrangler).not.toMatch('"main"');
		expect(wrangler).not.toMatch('"directory"');
		expect(wrangler).not.toMatch('pages_build_output_dir');
		expect(wrangler).toMatch('"binding": "ASSETS"');
		expect(wrangler).toMatch('"workers_dev": false');
	} else if (testCase.kind.type === 'cloudflare-pages-migrate') {
		const wrangler = readWrangler();
		expect(wrangler).toMatch('pages_build_output_dir');
		expect(wrangler).not.toMatch('"main"');
		expect(wrangler).not.toMatch('"assets"');
	}
});
