import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
	allowBuildsByVersion,
	detectPnpmMajor,
	readsWorkspaceSettings,
	writeAllowBuilds,
	writeLegacy
} from '../pnpm-internals.ts';
import { coerceVersion } from '../semver.ts';

describe('writeAllowBuilds', () => {
	const transform = (...packages: string[]) => writeAllowBuilds(packages);

	it('creates allowBuilds map in empty file', () => {
		expect(transform('esbuild')('')).toBe('allowBuilds:\n  esbuild: true\n');
	});

	it('appends to existing allowBuilds map', () => {
		const input = `packages:
  - 'packages/*'
allowBuilds:
  bar: true
`;
		expect(transform('esbuild')(input)).toBe(`packages:
  - 'packages/*'
allowBuilds:
  bar: true
  esbuild: true
`);
	});

	it('preserves false entries when adding new packages', () => {
		const input = `allowBuilds:
  core-js: false
`;
		expect(transform('esbuild')(input)).toBe(`allowBuilds:
  core-js: false
  esbuild: true
`);
	});

	it('migrates legacy onlyBuiltDependencies to allowBuilds', () => {
		const input = `packages:
  - 'packages/*'
onlyBuiltDependencies:
  - foo
  - bar
`;
		expect(transform('esbuild')(input)).toBe(`packages:
  - 'packages/*'
allowBuilds:
  foo: true
  bar: true
  esbuild: true
`);
	});

	it('merges legacy and existing allowBuilds without duplicating', () => {
		const input = `onlyBuiltDependencies:
  - shared
allowBuilds:
  shared: false
`;
		expect(transform('newone')(input)).toBe(`allowBuilds:
  shared: false
  newone: true
`);
	});

	it('is idempotent when package already present', () => {
		const input = `allowBuilds:
  esbuild: true
`;
		expect(transform('esbuild')(input)).toBe(input);
	});
});

describe('writeLegacy', () => {
	const transform = (...packages: string[]) => writeLegacy(packages);

	it('creates onlyBuiltDependencies list in empty file', () => {
		expect(transform('esbuild')('')).toBe('onlyBuiltDependencies:\n  - esbuild\n');
	});

	it('appends to existing onlyBuiltDependencies list', () => {
		const input = `onlyBuiltDependencies:
  - foo
`;
		expect(transform('esbuild')(input)).toBe(`onlyBuiltDependencies:
  - foo
  - esbuild
`);
	});

	it('is idempotent on legacy list', () => {
		const input = `onlyBuiltDependencies:
  - esbuild
`;
		expect(transform('esbuild')(input)).toBe(input);
	});
});

describe('pnpm < 10.5: no settings in pnpm-workspace.yaml', () => {
	it.each(['8.15.9', '9.15.0', '10.4.0'])('%s does not read them', (version) => {
		expect(readsWorkspaceSettings(version)).toBe(false);
	});

	it.each(['10.5.0', '11.0.0', '12.4.2', undefined])('%s reads them', (version) => {
		expect(readsWorkspaceSettings(version)).toBe(true);
	});
});

describe('allowBuildsForVersion', () => {
	const shape = (version: string | undefined, ...packages: string[]) =>
		allowBuildsByVersion(version, packages);

	it.each([
		['10.4.0', false],
		['10.5.0', 'onlyBuiltDependencies:\n  - esbuild\n'],
		['10.25.10', 'onlyBuiltDependencies:\n  - esbuild\n'],
		['10.26.0', 'allowBuilds:\n  esbuild: true\n'],
		['10.34.9', 'allowBuilds:\n  esbuild: true\n'],
		['11.0.0', 'allowBuilds:\n  esbuild: true\n'],
		// undetectable version assumes the modern syntax
		[undefined, 'allowBuilds:\n  esbuild: true\n']
	] as Array<[string | undefined, string | boolean]>)('%s', (version, expected) => {
		expect(shape(version, 'esbuild')('')).toBe(expected);
	});
});

describe('pnpm version detection', () => {
	const root = path.resolve(import.meta.dirname, '../../../..');

	it.runIf(detectPnpmMajor(root) !== undefined)(
		'honours the `devEngines.packageManager` from of the given cwd',
		{ timeout: 30_000 },
		() => {
			const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf-8'));
			const pinned = coerceVersion(pkg.devEngines.packageManager.version).major;

			expect(detectPnpmMajor(root)).toBe(pinned);
		}
	);
});
