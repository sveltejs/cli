import fs from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { exec, type PromiseWithChild } from 'node:child_process';
import { beforeAll, describe, test } from 'vitest';
import { create, type LanguageType, type TemplateType } from '../index.ts';

// Resolve the given path relative to the current file
const resolve_path = (path: string) => fileURLToPath(new URL(path, import.meta.url));

// use a directory outside of packages to ensure it isn't added to the pnpm workspace
const test_workspace_dir = resolve_path('../../../.test-output/create/');

// prepare test pnpm workspace
fs.rmSync(test_workspace_dir, { recursive: true, force: true });
fs.mkdirSync(test_workspace_dir, { recursive: true });

fs.writeFileSync(path.join(test_workspace_dir, 'pnpm-workspace.yaml'), 'packages:\n  - ./*\n');

const exec_async = promisify(exec);

beforeAll(async () => {
	await exec_async('pnpm install --no-frozen-lockfile', {
		cwd: test_workspace_dir
	});
}, 60000);

/**
 * Tests in different templates can be run concurrently for a nice speedup locally, but tests within a template must be run sequentially.
 * It'd be better to group tests by template, but vitest doesn't support that yet.
 */
const script_test_map = new Map<string, Array<[string, () => PromiseWithChild<any>]>>();

const templates = fs.readdirSync(resolve_path('../templates/')) as TemplateType[];

for (const template of templates) {
	if (template[0] === '.') continue;

	for (const types of ['checkjs', 'typescript'] as LanguageType[]) {
		const cwd = path.join(test_workspace_dir, `${template}-${types}`);
		fs.rmSync(cwd, { recursive: true, force: true });

		create(cwd, { name: `create-svelte-test-${template}-${types}`, template, types });

		const pkg = JSON.parse(fs.readFileSync(path.join(cwd, 'package.json'), 'utf-8'));

		// run provided scripts that are non-blocking. All of them should exit with 0
		// package script requires lib dir
		// TODO: lint should run before format
		const scripts_to_test = ['format', 'lint', 'check', 'build', 'package'].filter(
			(s) => s in pkg.scripts
		);

		for (const script of scripts_to_test) {
			const tests = script_test_map.get(script) ?? [];
			tests.push([`${template}-${types}`, () => exec_async(`pnpm ${script}`, { cwd })]);
			script_test_map.set(script, tests);
		}
	}
}

for (const [script, tests] of script_test_map) {
	describe.concurrent(script, { timeout: 60000 }, () => {
		for (const [name, task] of tests) {
			test(name, task);
		}
	});
}
