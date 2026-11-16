import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { toJsonSchema } from '@valibot/to-json-schema';
import { format } from 'oxfmt';
import { describe, expect, it } from 'vitest';
import oxfmtConfig from '../../../../../oxfmt.config.ts';
import type { AddonDefinition, LoadedAddon } from '../config.ts';
import { applyAddons, setupAddons } from '../engine.ts';
import { localLightAddonFile } from '../fetch-packages.ts';
import { LightAddonSchema } from '../light-addon-schema.ts';
import { loadLightAddon } from '../light-addon.ts';
import { createWorkspace } from '../workspace.ts';

const VITE_CONFIG = `import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({ plugins: [sveltekit()] });
`;

function tmp(prefix: string) {
	return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function write(dir: string, files: Record<string, string>) {
	for (const [rel, content] of Object.entries(files)) {
		const file = path.join(dir, rel);
		fs.mkdirSync(path.dirname(file), { recursive: true });
		fs.writeFileSync(file, content);
	}
}

function project(opts: { kit?: boolean; files?: Record<string, string> } = {}) {
	const kit = opts.kit ?? true;
	const cwd = tmp('sv-light-project-');
	const devDependencies: Record<string, string> = { vite: '^8.0.0', svelte: '^5.0.0' };
	if (kit) devDependencies['@sveltejs/kit'] = '^2.0.0';
	write(cwd, {
		'package.json': JSON.stringify({ name: 't', private: true, devDependencies }),
		'tsconfig.json': '{}',
		'vite.config.ts': kit ? VITE_CONFIG : VITE_CONFIG.replaceAll('sveltekit', 'svelte'),
		...opts.files
	});
	return cwd;
}

function addon(json: object, files: Record<string, string> = {}) {
	const dir = tmp('sv-light-addon-');
	write(dir, { 'sv.json': JSON.stringify(json), ...files });
	return loadLightAddon(path.join(dir, 'sv.json'));
}

async function run(cwd: string, a: AddonDefinition) {
	const workspace = await createWorkspace({ cwd, packageManager: 'pnpm' });
	const loadedAddons: LoadedAddon[] = [
		{ reference: { specifier: a.id, options: [], source: { kind: 'file', path: cwd } }, addon: a }
	];
	const setupResults = await setupAddons(loadedAddons, workspace);
	const result = await applyAddons({
		loadedAddons,
		workspace,
		setupResults,
		options: { [a.id]: {} }
	});
	return { ...result, setupResults, workspace };
}

const read = (cwd: string, rel: string) => fs.readFileSync(path.join(cwd, rel), 'utf8');
const devDeps = (cwd: string) => JSON.parse(read(cwd, 'package.json')).devDependencies;

// Published `sv.json` shapes. Frozen: never edit or delete one, only add new ones.
const CONTRACT = path.join(import.meta.dirname, 'light-addon', 'contract');
const fixture = (name: string) => loadLightAddon(path.join(CONTRACT, name, 'sv.json'));
const fixtureJson = (name: string) =>
	JSON.parse(fs.readFileSync(path.join(CONTRACT, name, 'sv.json'), 'utf8'));

describe('light add-on contract', () => {
	it('JSON schema matches the committed one', async () => {
		const json = JSON.stringify(toJsonSchema(LightAddonSchema));
		const { code } = await format('light-addon.schema.json', json, oxfmtConfig);
		await expect(code).toMatchFileSnapshot('../../../light-addon.schema.json');
	});

	it.for(fs.readdirSync(CONTRACT))('%s still loads and applies', async (name) => {
		const { status } = await run(project(), fixture(name));
		expect(status[fixtureJson(name).id]).toBe('success');
	});
});

describe('light add-on', () => {
	it('all-keys: deps, named vite plugin appended, next steps', async () => {
		const cwd = project();
		const a = fixture('all-keys');
		const { status, workspace } = await run(cwd, a);

		expect(status[a.id]).toBe('success');
		expect(devDeps(cwd)['all-keys-dev']).toBe('^1.0.0');
		expect(JSON.parse(read(cwd, 'package.json')).dependencies['all-keys']).toBe('^1.0.0');
		const vite = read(cwd, 'vite.config.ts');
		expect(vite).toContain(`import { allKeys } from 'all-keys/vite'`);
		expect(vite.indexOf('allKeys()')).toBeGreaterThan(vite.indexOf('sveltekit()'));
		expect(a.nextSteps?.({ ...workspace, options: {} })).toEqual(fixtureJson('all-keys').nextSteps);
	});

	it('all-keys: requires SvelteKit', async () => {
		const workspace = await createWorkspace({
			cwd: project({ kit: false }),
			packageManager: 'pnpm'
		});
		const a = fixture('all-keys');
		const [result] = await setupAddons(
			[
				{
					reference: { specifier: a.id, options: [], source: { kind: 'file', path: '' } },
					addon: a
				}
			],
			workspace
		).then((r) => Object.values(r));
		expect(result.unsupported).toEqual(['Requires SvelteKit']);
	});

	it('checker: default import, keeps declared versions, idempotent', async () => {
		const cwd = project();
		const pkg = JSON.parse(read(cwd, 'package.json'));
		pkg.devDependencies.typescript = '^5.9.0';
		fs.writeFileSync(path.join(cwd, 'package.json'), JSON.stringify(pkg));

		const a = fixture('vite-plugin-checker');
		await run(cwd, a);
		await run(cwd, a);

		expect(devDeps(cwd).typescript).toBe('^5.9.0');
		expect(devDeps(cwd)['svelte-check']).toBe('^4.7.6');
		const vite = read(cwd, 'vite.config.ts');
		expect(vite).toContain(`import checker from 'vite-plugin-checker'`);
		expect(vite.match(/checker\(/g)).toHaveLength(1);
	});

	it('devtools: start plugins keep their authored order', async () => {
		const cwd = project();
		await run(cwd, fixture('devtools'));

		const vite = read(cwd, 'vite.config.ts');
		const svelteDevtools = vite.indexOf('svelteDevtools()');
		expect(svelteDevtools).toBeGreaterThan(-1);
		expect(vite.indexOf('DevTools()')).toBeGreaterThan(svelteDevtools);
		expect(vite.indexOf('sveltekit()')).toBeGreaterThan(vite.indexOf('DevTools()'));
	});

	it('files: picks the language layer, never overwrites, maps $lib', async () => {
		const cwd = project({ files: { 'src/lib/mine/keep.ts': 'user' } });
		const a = addon(
			{ id: 'my-files', files: [{ from: './template', to: '$lib/mine' }] },
			{
				'template/ts/keep.ts': 'addon',
				'template/ts/nested/new.ts': 'export const x = 1;\n',
				'template/js/new.js': 'nope'
			}
		);
		await run(cwd, a);

		expect(read(cwd, 'src/lib/mine/keep.ts')).toBe('user');
		expect(read(cwd, 'src/lib/mine/nested/new.ts')).toBe('export const x = 1;\n');
		expect(fs.existsSync(path.join(cwd, 'src/lib/mine/new.js'))).toBe(false);
	});

	it('files: cancels when only the other language is shipped', async () => {
		const cwd = project();
		const a = addon(
			{ id: 'js-only', files: [{ from: './template', to: 'src' }] },
			{ 'template/js/a.js': '' }
		);
		const { status } = await run(cwd, a);
		expect(status[a.id]).toEqual([`'./template' only ships JavaScript files`]);
	});

	it('hooks + demo: server handle and demo page', async () => {
		const cwd = project();
		const a = addon(
			{
				id: 'my-lib',
				hooks: {
					server: [{ from: 'my-lib/server', import: 'createHandle', call: 'createHandle()' }]
				},
				demo: './demo'
			},
			{ 'demo/+page.svelte': '<h1>demo</h1>\n' }
		);
		await run(cwd, a);

		const hooks = read(cwd, 'src/hooks.server.ts');
		expect(hooks).toContain(`import { createHandle } from 'my-lib/server'`);
		expect(hooks).toContain('const handleMyLib');
		expect(hooks).toContain('createHandle()');
		expect(read(cwd, 'src/routes/demo/my-lib/+page.svelte')).toBe('<h1>demo</h1>\n');
		expect(read(cwd, 'src/routes/demo/DemoLinks.svelte')).toContain(`'/demo/my-lib'`);
		expect(read(cwd, 'src/routes/+layout.svelte')).toContain('<DemoLinks />');
	});

	it('rejects unknown keys', () => {
		expect(() => addon({ id: 'x', scripts: { a: 'b' } })).toThrow(/Invalid light add-on/);
	});
});

describe('localLightAddonFile', () => {
	it('finds sv.json, unless a ./sv code export exists', () => {
		const dir = tmp('sv-light-local-');
		write(dir, { 'sv.json': '{}' });
		expect(localLightAddonFile(dir)).toBe(path.join(dir, 'sv.json'));
		expect(localLightAddonFile(path.join(dir, 'sv.json'))).toBe(path.join(dir, 'sv.json'));

		write(dir, { 'package.json': JSON.stringify({ exports: { './sv': './sv.js' } }) });
		expect(localLightAddonFile(dir)).toBeUndefined();
	});
});
