import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import { hasSvExport, importAddonCode } from '../fetch-packages.ts';

// add-ons are imported by bare specifier, so fixtures have to live where `sv` resolves from
const NODE_MODULES = fileURLToPath(new URL('../../../node_modules', import.meta.url));
const PREFIX = 'sv-fixture-addon-';

type Fixture = { exports?: unknown; main?: string; files: Record<string, string> };

let counter = 0;
function writeFixture(fixture: Fixture): string {
	const name = `${PREFIX}${counter++}`;
	const dir = path.join(NODE_MODULES, name);

	for (const [file, contents] of Object.entries(fixture.files)) {
		const filePath = path.join(dir, file);
		fs.mkdirSync(path.dirname(filePath), { recursive: true });
		fs.writeFileSync(filePath, contents);
	}

	const pkg: Record<string, unknown> = { name, version: '1.0.0', type: 'module' };
	if (fixture.exports !== undefined) pkg.exports = fixture.exports;
	if (fixture.main !== undefined) pkg.main = fixture.main;
	fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify(pkg));

	return name;
}

afterAll(() => {
	for (const entry of fs.readdirSync(NODE_MODULES)) {
		if (entry.startsWith(PREFIX)) {
			fs.rmSync(path.join(NODE_MODULES, entry), { recursive: true, force: true });
		}
	}
});

const ADDON = `export default { id: 'fixture', shortDescription: 'x', homepage: '', options: {}, run: () => {} }`;

describe('hasSvExport', () => {
	it('detects a mapped ./sv entry', () => {
		expect(hasSvExport({ '.': './a.mjs', './sv': './sv.mjs' })).toBe(true);
	});
	it('ignores packages without a ./sv entry', () => {
		expect(hasSvExport({ '.': './a.mjs' })).toBe(false);
	});
	it('does not throw on the string form', () => {
		expect(hasSvExport('./dist/index.mjs')).toBe(false);
	});
	it('does not throw on the array form', () => {
		expect(hasSvExport(['./dist/index.mjs'])).toBe(false);
	});
	it('does not throw when exports is absent', () => {
		expect(hasSvExport(undefined)).toBe(false);
	});
});

describe('importAddonCode', () => {
	it('loads a package whose exports field is a bare string', async () => {
		const name = writeFixture({
			exports: './dist/index.mjs',
			files: { 'dist/index.mjs': ADDON }
		});
		await expect(importAddonCode(name, '1.0.0', './dist/index.mjs')).resolves.toMatchObject({
			id: 'fixture'
		});
	});

	it('loads a package that only declares main', async () => {
		const name = writeFixture({ main: './dist/index.mjs', files: { 'dist/index.mjs': ADDON } });
		await expect(importAddonCode(name, '1.0.0', undefined)).resolves.toMatchObject({
			id: 'fixture'
		});
	});

	it('loads a package whose exports only declares conditions', async () => {
		const exports = { import: './dist/index.mjs', default: './dist/index.mjs' };
		const name = writeFixture({ exports, files: { 'dist/index.mjs': ADDON } });
		await expect(importAddonCode(name, '1.0.0', exports)).resolves.toMatchObject({
			id: 'fixture'
		});
	});

	it('prefers ./sv over the default entry', async () => {
		const exports = { '.': './dist/main.mjs', './sv': './dist/sv.mjs' };
		const name = writeFixture({
			exports,
			files: {
				'dist/main.mjs': `export default { id: 'main' }`,
				'dist/sv.mjs': `export default { id: 'sv' }`
			}
		});
		await expect(importAddonCode(name, '1.0.0', exports)).resolves.toMatchObject({ id: 'sv' });
	});

	it('falls back to the default entry when ./sv is missing from the tarball', async () => {
		const exports = { '.': './dist/main.mjs', './sv': './dist/gone.mjs' };
		const name = writeFixture({ exports, files: { 'dist/main.mjs': ADDON } });
		await expect(importAddonCode(name, '1.0.0', exports)).resolves.toMatchObject({
			id: 'fixture'
		});
	});

	it('reports unbundled dependencies for an ESM entry', async () => {
		const exports = { '.': './dist/index.mjs' };
		const name = writeFixture({
			exports,
			files: { 'dist/index.mjs': `import 'sv-fixture-absent-dep';\n${ADDON}` }
		});
		await expect(importAddonCode(name, '1.0.0', exports)).rejects.toThrow(
			/dependencies that are not bundled/
		);
	});

	it('reports unbundled dependencies for a CJS entry', async () => {
		const exports = { '.': './dist/index.cjs' };
		const name = writeFixture({
			exports,
			files: { 'dist/index.cjs': `require('sv-fixture-absent-dep');\nmodule.exports = {}` }
		});
		await expect(importAddonCode(name, '1.0.0', exports)).rejects.toThrow(
			/dependencies that are not bundled/
		);
	});

	it('names the missing module rather than swallowing it', async () => {
		const exports = { '.': './dist/index.mjs' };
		const name = writeFixture({
			exports,
			files: { 'dist/index.mjs': `import 'sv-fixture-absent-dep';\n${ADDON}` }
		});
		await expect(importAddonCode(name, '1.0.0', exports)).rejects.toThrow(/sv-fixture-absent-dep/);
	});

	it('says so when the entry has no default export', async () => {
		const exports = { '.': './dist/index.mjs' };
		const name = writeFixture({
			exports,
			files: { 'dist/index.mjs': `export const addon = {}` }
		});
		await expect(importAddonCode(name, '1.0.0', exports)).rejects.toThrow(/no default export/);
	});

	it('never renders an empty bullet', async () => {
		const exports = { '.': './dist/index.mjs' };
		const name = writeFixture({
			exports,
			files: { 'dist/index.mjs': `export const addon = {}` }
		});
		await expect(importAddonCode(name, '1.0.0', exports)).rejects.toThrow(
			expect.objectContaining({ message: expect.not.stringMatching(/-\s*\n/) })
		);
	});
});
