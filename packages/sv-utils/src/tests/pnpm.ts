import { describe, expect, it } from 'vitest';
import { allowBuilds, onlyBuiltDependencies } from '../pnpm.ts';

// We assume the test runner has pnpm 11+ available on PATH (the repo itself is on pnpm 11).
describe('allowBuilds', () => {
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
});

describe('onlyBuiltDependencies (deprecated)', () => {
	it('delegates to allowBuilds', () => {
		expect(onlyBuiltDependencies('esbuild')('')).toBe('allowBuilds:\n  esbuild: true\n');
	});
});
