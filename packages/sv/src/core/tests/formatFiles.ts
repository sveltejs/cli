import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { findFormatScript } from '../formatFiles.ts';

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

afterEach(() => {
	for (const dir of dirs.splice(0)) {
		fs.rmSync(dir, { recursive: true, force: true });
	}
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
