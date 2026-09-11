import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { detectPnpmMajor } from '../pnpm-internals.ts';
import { allowBuilds } from '../pnpm.ts';

describe('allowBuilds (pnpm >= 11: writes allowBuilds map)', () => {
	const transform = (pkg: string) => allowBuilds(pkg, { pnpmVersion: 11 });

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

describe('allowBuilds (pnpm < 11: writes onlyBuiltDependencies list)', () => {
	const transform = (pkg: string) => allowBuilds(pkg, { pnpmVersion: 10 });

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

describe('allowBuilds version detection', () => {
	it('accepts an array of packages plus options', () => {
		expect(allowBuilds(['esbuild', 'workerd'], { pnpmVersion: 10 })('')).toBe(
			'onlyBuiltDependencies:\n  - esbuild\n  - workerd\n'
		);
	});

	it('accepts trailing options after rest package names', () => {
		expect(allowBuilds('esbuild', 'workerd', { pnpmVersion: 11 })('')).toBe(
			'allowBuilds:\n  esbuild: true\n  workerd: true\n'
		);
	});

	it('detects pnpm from the target cwd, not process.cwd()', { timeout: 30_000 }, () => {
		const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sv-pnpm-'));
		try {
			fs.writeFileSync(
				path.join(dir, 'package.json'),
				JSON.stringify({ name: 'pin11', packageManager: 'pnpm@11.0.0' })
			);

			expect(detectPnpmMajor(process.cwd())).toBe(10);
			expect(detectPnpmMajor(dir)).toBe(11);
			expect(allowBuilds('esbuild', { cwd: dir })('')).toBe('allowBuilds:\n  esbuild: true\n');
		} finally {
			fs.rmSync(dir, { recursive: true, force: true });
		}
	});
});
