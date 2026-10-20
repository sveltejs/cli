import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { AgentName } from '@sveltejs/sv-utils';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { addAllowBuildsIfPnpm, addDevEnginesIfPnpm, addEngineStrict } from '../package-manager.ts';

const createdDirs: string[] = [];

/** a stand-in for a freshly scaffolded project: tab-indented `package.json`, empty `pnpm-workspace.yaml` */
function createProjectDir(): string {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sv-pnpm-pipeline-'));
	createdDirs.push(dir);

	fs.writeFileSync(
		path.join(dir, 'package.json'),
		JSON.stringify(
			{
				name: 'test-app',
				private: true,
				version: '0.0.1',
				type: 'module',
				scripts: {
					dev: 'vite dev',
					build: 'vite build',
					preview: 'vite preview'
				},
				devDependencies: {
					'@sveltejs/kit': '^2.0.0',
					svelte: '^5.0.0',
					vite: '^7.0.0'
				}
			},
			null,
			'\t'
		)
	);
	fs.writeFileSync(path.join(dir, 'pnpm-workspace.yaml'), '');

	return dir;
}

afterEach(() => {
	for (const dir of createdDirs) fs.rmSync(dir, { recursive: true, force: true });
	createdDirs.length = 0;
});

describe('pnpm create pipeline', () => {
	let pkg: string;
	let yaml: string;

	beforeAll(
		() => {
			const dir = createProjectDir();

			// the pnpm-only steps of `createProject`, in order
			addEngineStrict({ cwd: dir, packageManager: 'pnpm' });
			addDevEnginesIfPnpm({ cwd: dir, packageManager: 'pnpm' });
			addAllowBuildsIfPnpm({ cwd: dir, packageManager: 'pnpm', packages: ['esbuild'] });

			pkg = fs.readFileSync(path.join(dir, 'package.json'), 'utf8');
			yaml = fs.readFileSync(path.join(dir, 'pnpm-workspace.yaml'), 'utf8');
		},
		// `pnpm --version` inside `allowBuilds` may resolve the pinned pnpm on first run
		{ timeout: 30_000 }
	);

	it('writes `devEngines` into `package.json`', () => {
		expect(pkg).toMatchInlineSnapshot(`
			"{
				"name": "test-app",
				"private": true,
				"version": "0.0.1",
				"type": "module",
				"scripts": {
					"dev": "vite dev",
					"build": "vite build",
					"preview": "vite preview"
				},
				"devDependencies": {
					"@sveltejs/kit": "^2.0.0",
					"svelte": "^5.0.0",
					"vite": "^7.0.0"
				},
				"devEngines": {
					"runtime": {
						"name": "node",
						"version": "^22.18.0",
						"onFail": "download"
					},
					"packageManager": {
						"name": "pnpm",
						"version": "^11.28.3",
						"onFail": "download"
					}
				}
			}"
		`);
	});

	it('writes `engineStrict` and the allow-builds config into `pnpm-workspace.yaml`', () => {
		if (yaml.includes('onlyBuiltDependencies')) {
			// pnpm < 11: legacy allow-builds list
			expect(yaml).toMatchInlineSnapshot(`
				"engineStrict: true
				onlyBuiltDependencies:
				  - esbuild
				"
			`);
		} else {
			// pnpm >= 11: unified `allowBuilds` map
			expect(yaml).toMatchInlineSnapshot(`
				"engineStrict: true
				allowBuilds:
				  esbuild: true
				"
			`);
		}
	});
});

describe('non-pnpm package managers', () => {
	it('leaves the project files untouched', () => {
		const pkgOriginal = '{\n\t"name": "test-app"\n}';

		for (const packageManager of ['npm', 'yarn', 'bun', 'deno', null, undefined] as Array<
			AgentName | null | undefined
		>) {
			const dir = createProjectDir();
			fs.writeFileSync(path.join(dir, 'package.json'), pkgOriginal);

			addDevEnginesIfPnpm({ cwd: dir, packageManager });
			addAllowBuildsIfPnpm({ cwd: dir, packageManager, packages: ['esbuild'] });

			expect(fs.readFileSync(path.join(dir, 'package.json'), 'utf8')).toBe(pkgOriginal);
			expect(fs.readFileSync(path.join(dir, 'pnpm-workspace.yaml'), 'utf8')).toBe('');
		}
	});
});
