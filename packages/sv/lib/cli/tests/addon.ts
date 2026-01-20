import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { classifyAddons } from '../add/index.ts';
import { type AddonInput } from '../../core.ts';
import { getErrorHint } from '../../coreInternal.ts';

const testCwd = '/test/project';

describe('classifyAddons', () => {
	it('should find official addon', () => {
		const inputs: AddonInput[] = [{ specifier: 'eslint', options: [] }];
		const result = classifyAddons(inputs, testCwd);
		expect(result).toHaveLength(1);
		expect(result[0].specifier).toBe('eslint');
		expect(result[0].source.kind).toBe('official');
		if (result[0].source.kind === 'official') {
			expect(result[0].source.id).toBe('eslint');
		}
		expect(result[0].options).toEqual([]);
	});
	it('should find official addon with alias', () => {
		const inputs: AddonInput[] = [{ specifier: 'tailwind', options: [] }];
		const result = classifyAddons(inputs, testCwd);
		expect(result).toHaveLength(1);
		expect(result[0].specifier).toBe('tailwind');
		expect(result[0].source.kind).toBe('official');
		if (result[0].source.kind === 'official') {
			expect(result[0].source.id).toBe('tailwindcss');
		}
	});
	it('should have 2', () => {
		const inputs: AddonInput[] = [
			{ specifier: 'eslint', options: [] },
			{ specifier: 'tailwindcss', options: [] }
		];
		const result = classifyAddons(inputs, testCwd);
		expect(result).toHaveLength(2);
		if (result[0].source.kind === 'official') {
			expect(result[0].source.id).toBe('eslint');
		}
		if (result[1].source.kind === 'official') {
			expect(result[1].source.id).toBe('tailwindcss');
		}
	});
	it('should dedupe even with alias', () => {
		const inputs: AddonInput[] = [
			{ specifier: 'tailwind', options: [] },
			{ specifier: 'tailwindcss', options: [] }
		];
		const result = classifyAddons(inputs, testCwd);
		expect(result).toHaveLength(1);
		if (result[0].source.kind === 'official') {
			expect(result[0].source.id).toBe('tailwindcss');
		}
	});
	it('should find file addons', () => {
		const inputs: AddonInput[] = [{ specifier: 'file:../', options: [] }];
		const result = classifyAddons(inputs, testCwd);
		expect(result).toHaveLength(1);
		expect(result[0].specifier).toBe('file:../');
		expect(result[0].source.kind).toBe('file');
		if (result[0].source.kind === 'file') {
			expect(result[0].source.path).toBe(path.resolve(testCwd, '../'));
		}
	});
	it('should provide error hints based on kind', () => {
		const [official] = classifyAddons([{ specifier: 'eslint', options: [] }], testCwd);
		expect(getErrorHint(official.source)).toContain('github.com/sveltejs/cli');

		const [file] = classifyAddons([{ specifier: 'file:../', options: [] }], testCwd);
		expect(getErrorHint(file.source)).toContain('local add-on');

		const [npm] = classifyAddons([{ specifier: '@supacool', options: [] }], testCwd);
		expect(getErrorHint(npm.source)).toContain('npmjs.com');
	});
});
