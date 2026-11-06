import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { findFormatScript, isPrettierInstalled } from '../formatFiles.ts';

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
		JSON.stringify({ name: 'prettier', version: '3.0.0', main: 'index.js' })
	);
	fs.writeFileSync(path.join(prettierDir, 'index.js'), '');
}

afterEach(() => {
	for (const dir of dirs.splice(0)) {
		fs.rmSync(dir, { recursive: true, force: true });
	}
});

describe('isPrettierInstalled', () => {
	it('is false when prettier is declared but not installed', () => {
		const cwd = makeProject({ devDependencies: { prettier: '^3.0.0' } });
		expect(isPrettierInstalled(cwd)).toBe(false);
	});

	it('is true when prettier resolves from the project', () => {
		const cwd = makeProject({ devDependencies: { prettier: '^3.0.0' } });
		addPrettierFixture(cwd);
		expect(isPrettierInstalled(cwd)).toBe(true);
	});
});

describe('findFormatScript', () => {
	it("finds a 'format' script", () => {
		const cwd = makeProject({ scripts: { format: 'biome check --write' } });
		expect(findFormatScript(cwd)).toEqual({ dir: cwd, name: 'format' });
	});

	it("finds a 'fmt' script", () => {
		const cwd = makeProject({ scripts: { fmt: 'dprint fmt' } });
		expect(findFormatScript(cwd)).toEqual({ dir: cwd, name: 'fmt' });
	});

	it('prefers `format` over `fmt`', () => {
		const cwd = makeProject({ scripts: { fmt: 'dprint fmt', format: 'prettier --write .' } });
		expect(findFormatScript(cwd)).toEqual({ dir: cwd, name: 'format' });
	});

	it('returns undefined when there is none', () => {
		const cwd = makeProject();
		expect(findFormatScript(cwd)).toBeUndefined();
	});
});
