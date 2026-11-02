import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { isPkgInstalled, resolveFormatAction } from '../formatFiles.ts';

const prettierVersion = '3.0.0';
const oxfmtVersion = '0.70.0';
const dirs: string[] = [];

function makeProject(pkg: Record<string, unknown> = {}) {
	const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'sv-format-'));
	dirs.push(cwd);
	fs.writeFileSync(
		path.join(cwd, 'package.json'),
		JSON.stringify({ name: 't', private: true, ...pkg })
	);
	return cwd;
}

// Emulates a project with a `prettier` package installed.
function addPrettierFixture(cwd: string) {
	const prettierDir = path.join(cwd, 'node_modules', 'prettier');
	fs.mkdirSync(prettierDir, { recursive: true });
	fs.writeFileSync(
		path.join(prettierDir, 'package.json'),
		JSON.stringify({ name: 'prettier', version: prettierVersion, main: 'index.js' })
	);
	fs.writeFileSync(path.join(prettierDir, 'index.js'), '');
}

// Emulates a project with `oxfmt` package installed.
function addOxfmtFixture(cwd: string) {
	const oxfmtDir = path.join(cwd, 'node_modules', 'oxfmt');
	fs.mkdirSync(oxfmtDir, { recursive: true });
	fs.writeFileSync(
		path.join(oxfmtDir, 'package.json'),
		JSON.stringify({ name: 'oxfmt', version: '3.0.0', main: 'index.js' })
	);
	fs.writeFileSync(path.join(oxfmtDir, 'index.js'), '');
}

afterEach(() => {
	for (const dir of dirs.splice(0)) {
		fs.rmSync(dir, { recursive: true, force: true });
	}
});

describe('resolveFormatAction', () => {
	it('skips when the project has no formatter', () => {
		const cwd = makeProject();
		expect(resolveFormatAction(cwd, 'files-only')).toEqual({ kind: 'skip' });
		expect(resolveFormatAction(cwd, 'project-script-then-files-only')).toEqual({ kind: 'skip' });
	});

	it('skips when prettier cannot be resolved (not installed)', () => {
		const cwd = makeProject({ devDependencies: { prettier: `^${prettierVersion}` } });
		expect(isPkgInstalled(cwd, 'prettier')).toBe(false);
		expect(resolveFormatAction(cwd, 'files-only')).toEqual({ kind: 'skip' });
	});

	it("uses a 'format' script before prettier", () => {
		const cwd = makeProject({
			scripts: { format: 'biome check --write' },
			devDependencies: { prettier: `^${prettierVersion}` }
		});
		addPrettierFixture(cwd);
		expect(resolveFormatAction(cwd, 'project-script-then-files-only')).toEqual({
			kind: 'script',
			dir: cwd,
			name: 'format'
		});
		expect(resolveFormatAction(cwd, 'files-only')).toEqual({ kind: 'prettier' });
	});

	it("uses a 'fmt' script", () => {
		const cwd = makeProject({ scripts: { fmt: 'dprint fmt' } });
		expect(resolveFormatAction(cwd, 'project-script-then-files-only')).toEqual({
			kind: 'script',
			dir: cwd,
			name: 'fmt'
		});
	});

	it('uses prettier when the package resolves', () => {
		const cwd = makeProject({ devDependencies: { prettier: `^${prettierVersion}` } });
		addPrettierFixture(cwd);
		expect(isPkgInstalled(cwd, 'prettier')).toBe(true);
		expect(resolveFormatAction(cwd, 'project-script-then-files-only')).toEqual({
			kind: 'prettier'
		});
	});

	it('uses oxfmt script when the package resolves', () => {
		const cwd = makeProject({ devDependencies: { oxfmt: `^${oxfmtVersion}` } });
		addOxfmtFixture(cwd);
		expect(isPkgInstalled(cwd, 'oxfmt')).toBe(true);
		expect(resolveFormatAction(cwd, 'files-only')).toEqual({
			kind: 'script',
			dir: cwd,
			name: 'fmt'
		});
		expect(resolveFormatAction(cwd, 'project-script-then-files-only')).toEqual({
			kind: 'script',
			dir: cwd,
			name: 'fmt'
		});
	});
});
