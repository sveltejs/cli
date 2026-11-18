import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import migration from './index.ts';

const testDirectories: string[] = [];

afterEach(() => {
	for (const directory of testDirectories.splice(0)) {
		fs.rmSync(directory, { recursive: true, force: true });
	}
});

describe('teardown', () => {
	it('removes stale generated files and runs sync after installing dependencies', async () => {
		const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'sv-migrate-sveltekit-3-'));
		testDirectories.push(cwd);

		const staleFile = path.join(cwd, '.svelte-kit', 'ambient.d.ts');
		fs.mkdirSync(path.dirname(staleFile), { recursive: true });
		fs.writeFileSync(staleFile, "declare module '$app/environment';");

		const executeLocal = vi.fn();
		await migration.teardown!({
			cwd,
			dependenciesInstalled: true,
			executeLocal
		});

		expect(fs.existsSync(path.join(cwd, '.svelte-kit'))).toBe(false);
		expect(executeLocal).toHaveBeenCalledWith(['svelte-kit', 'sync'], 'inherit');
	});

	it('clears generated files without syncing when dependency installation is skipped', async () => {
		const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'sv-migrate-sveltekit-3-'));
		testDirectories.push(cwd);
		fs.mkdirSync(path.join(cwd, '.svelte-kit'));

		const executeLocal = vi.fn();
		await migration.teardown!({
			cwd,
			dependenciesInstalled: false,
			executeLocal
		});

		expect(fs.existsSync(path.join(cwd, '.svelte-kit'))).toBe(false);
		expect(executeLocal).not.toHaveBeenCalled();
	});
});
