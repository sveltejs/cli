import { describe, expect, it } from 'vitest';
import { detectPnpmMajor } from '../pnpm-internals.ts';
import { allowBuilds, onlyBuiltDependencies } from '../pnpm.ts';

const major = detectPnpmMajor();
const isPnpm11 = major === undefined || major >= 11;

describe.runIf(isPnpm11)('allowBuilds (pnpm >= 11: writes allowBuilds map)', () => {
	it('creates allowBuilds map in empty file', () => {
		expect(allowBuilds('esbuild')('')).toBe('allowBuilds:\n  esbuild: true\n');
	});

	it('appends to existing allowBuilds map', () => {
		const input = `packages:
  - 'packages/*'
allowBuilds:
  bar: true
`;
		expect(allowBuilds('esbuild')(input)).toBe(`packages:
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
		expect(allowBuilds('esbuild')(input)).toBe(`allowBuilds:
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
		expect(allowBuilds('esbuild')(input)).toBe(`packages:
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
		expect(allowBuilds('newone')(input)).toBe(`allowBuilds:
  shared: false
  newone: true
`);
	});

	it('is idempotent when package already present', () => {
		const input = `allowBuilds:
  esbuild: true
`;
		expect(allowBuilds('esbuild')(input)).toBe(input);
	});

	it('deprecated onlyBuiltDependencies delegates to allowBuilds', () => {
		expect(onlyBuiltDependencies('esbuild')('')).toBe('allowBuilds:\n  esbuild: true\n');
	});
});

describe.runIf(!isPnpm11)('allowBuilds (pnpm < 11: writes onlyBuiltDependencies list)', () => {
	it('creates onlyBuiltDependencies list in empty file', () => {
		expect(allowBuilds('esbuild')('')).toBe('onlyBuiltDependencies:\n  - esbuild\n');
	});

	it('appends to existing onlyBuiltDependencies list', () => {
		const input = `onlyBuiltDependencies:
  - foo
`;
		expect(allowBuilds('esbuild')(input)).toBe(`onlyBuiltDependencies:
  - foo
  - esbuild
`);
	});

	it('is idempotent on legacy list', () => {
		const input = `onlyBuiltDependencies:
  - esbuild
`;
		expect(allowBuilds('esbuild')(input)).toBe(input);
	});

	it('deprecated onlyBuiltDependencies delegates to allowBuilds', () => {
		expect(onlyBuiltDependencies('esbuild')('')).toBe('onlyBuiltDependencies:\n  - esbuild\n');
	});
});
