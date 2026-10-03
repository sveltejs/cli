import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parse } from '@sveltejs/sv-utils';
import { describe, expect, it } from 'vitest';
import { defineAddon, defineAddonOptions, type LoadedAddon } from '../config.ts';
import { applyAddons, prepareSvApi, setupAddons } from '../engine.ts';
import { createWorkspace } from '../workspace.ts';

function makeWorkspace() {
	const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'sv-engine-'));
	fs.writeFileSync(path.join(cwd, 'package.json'), '{"name":"t","private":true}');
	return cwd;
}
const loaded = (a: ReturnType<typeof defineAddon<any, any>>): LoadedAddon => ({
	reference: { specifier: a.id, options: [], source: { kind: 'official', id: a.id } },
	addon: a
});
const dep = defineAddon({
	id: 'dep',
	options: defineAddonOptions().build(),
	run: ({ cancel }) => cancel('nope')
});

describe('applyAddons cancel propagation', () => {
	it("skips addons whose 'dependsOn' was canceled", async () => {
		const child = defineAddon({
			id: 'child',
			options: defineAddonOptions().build(),
			setup: ({ dependsOn }) => dependsOn('dep'),
			run: () => expect.fail('child should not have run')
		});
		const workspace = await createWorkspace({ cwd: makeWorkspace() });
		const addons = [loaded(dep), loaded(child)];
		const { status } = await applyAddons({
			loadedAddons: addons,
			workspace,
			setupResults: await setupAddons(addons, workspace),
			options: { dep: {}, child: {} }
		});
		expect(status.dep).toEqual(['nope']);
		expect(status.child).toEqual(["Because dependency 'dep' was canceled"]);
	});

	it("does not skip addons that only 'runsAfter' a canceled addon", async () => {
		let ran = false;
		const child = defineAddon({
			id: 'child',
			options: defineAddonOptions().build(),
			setup: ({ runsAfter }) => runsAfter('dep'),
			run: () => {
				ran = true;
			}
		});
		const workspace = await createWorkspace({ cwd: makeWorkspace() });
		const addons = [loaded(dep), loaded(child)];
		const { status } = await applyAddons({
			loadedAddons: addons,
			workspace,
			setupResults: await setupAddons(addons, workspace),
			options: { dep: {}, child: {} }
		});
		expect(status.child).toBe('success');
		expect(ran).toBe(true);
	});
});

describe('sv.removeFile', () => {
	it('removes files that match the file filter', async () => {
		const cwd = makeWorkspace();
		fs.writeFileSync(path.join(cwd, 'remove.txt'), 'remove me');
		const workspace = await createWorkspace({ cwd });
		const { sv, finalize } = prepareSvApi(workspace, { filesFilter: '**/*.txt' });

		sv.removeFile('remove.txt');

		expect(fs.existsSync(path.join(cwd, 'remove.txt'))).toBe(false);
		expect(finalize().unmodifiedFiles).toEqual(new Set());
	});

	it('preserves and reports files that do not match the file filter', async () => {
		const cwd = makeWorkspace();
		fs.writeFileSync(path.join(cwd, 'keep.js'), 'keep me');
		const workspace = await createWorkspace({ cwd });
		const { sv, finalize } = prepareSvApi(workspace, { filesFilter: '**/*.txt' });

		sv.removeFile('keep.js');

		expect(fs.readFileSync(path.join(cwd, 'keep.js'), 'utf8')).toBe('keep me');
		expect(finalize().unmodifiedFiles).toEqual(new Set(['keep.js']));
	});
});

describe('dependency package-manager settings', () => {
	it('respects save-exact from .npmrc', async () => {
		const cwd = makeWorkspace();
		fs.writeFileSync(
			path.join(cwd, 'package.json'),
			JSON.stringify({ name: 't', private: true, devDependencies: { foo: '^1.0.0' } })
		);
		fs.writeFileSync(path.join(cwd, '.npmrc'), 'save-exact=true\n');
		const workspace = await createWorkspace({ cwd, packageManager: 'pnpm' });
		const { sv, finalize } = prepareSvApi(workspace);

		sv.devDependency('foo', '^2.0.0');
		finalize();

		const pkg = JSON.parse(fs.readFileSync(path.join(cwd, 'package.json'), 'utf8'));
		expect(pkg.devDependencies.foo).toBe('2.0.0');
	});

	it('respects pnpm 11 saveExact from pnpm-workspace.yaml', async () => {
		const cwd = makeWorkspace();
		fs.writeFileSync(
			path.join(cwd, 'package.json'),
			JSON.stringify({ name: 't', private: true, devDependencies: { foo: '^1.0.0' } })
		);
		fs.writeFileSync(path.join(cwd, 'pnpm-workspace.yaml'), 'saveExact: true\n');
		const workspace = await createWorkspace({ cwd, packageManager: 'pnpm' });
		const { sv, finalize } = prepareSvApi(workspace);

		sv.devDependency('foo', '^2.0.0');
		finalize();

		const pkg = JSON.parse(fs.readFileSync(path.join(cwd, 'package.json'), 'utf8'));
		expect(pkg.devDependencies.foo).toBe('2.0.0');
	});

	it('keeps default catalog references and updates the catalog version', async () => {
		const root = makeWorkspace();
		const cwd = path.join(root, 'packages', 'app');
		fs.mkdirSync(cwd, { recursive: true });
		fs.writeFileSync(
			path.join(cwd, 'package.json'),
			JSON.stringify({
				name: 'app',
				private: true,
				devDependencies: { foo: 'catalog:' }
			})
		);
		fs.writeFileSync(
			path.join(root, 'pnpm-workspace.yaml'),
			"packages:\n  - 'packages/*'\nsaveExact: true\ncatalog:\n  foo: 1.0.0\n"
		);
		const workspace = await createWorkspace({ cwd, packageManager: 'pnpm' });
		const { sv, finalize } = prepareSvApi(workspace);

		sv.devDependency('foo', '^2.0.0');
		const result = finalize();

		const pkg = JSON.parse(fs.readFileSync(path.join(cwd, 'package.json'), 'utf8'));
		const yaml = parse.yaml(fs.readFileSync(path.join(root, 'pnpm-workspace.yaml'), 'utf8')).data;
		const catalog = yaml.get('catalog') as { get(key: string): unknown };
		expect(result.installNeeded).toBe(true);
		expect(pkg.devDependencies.foo).toBe('catalog:');
		expect(catalog.get('foo')).toBe('2.0.0');
	});

	it('keeps named catalog references and updates the named catalog', async () => {
		const root = makeWorkspace();
		const cwd = path.join(root, 'packages', 'app');
		fs.mkdirSync(cwd, { recursive: true });
		fs.writeFileSync(
			path.join(cwd, 'package.json'),
			JSON.stringify({
				name: 'app',
				private: true,
				devDependencies: { foo: 'catalog:frontend' }
			})
		);
		fs.writeFileSync(
			path.join(root, 'pnpm-workspace.yaml'),
			"packages:\n  - 'packages/*'\ncatalogs:\n  frontend:\n    foo: ^1.0.0\n"
		);
		const workspace = await createWorkspace({ cwd, packageManager: 'pnpm' });
		const { sv, finalize } = prepareSvApi(workspace);

		sv.devDependency('foo', '^2.0.0');
		finalize();

		const pkg = JSON.parse(fs.readFileSync(path.join(cwd, 'package.json'), 'utf8'));
		const yaml = parse.yaml(fs.readFileSync(path.join(root, 'pnpm-workspace.yaml'), 'utf8')).data;
		const catalogs = yaml.get('catalogs') as { get(key: string): unknown };
		const frontend = catalogs.get('frontend') as { get(key: string): unknown };
		expect(pkg.devDependencies.foo).toBe('catalog:frontend');
		expect(frontend.get('foo')).toBe('^2.0.0');
	});
});

