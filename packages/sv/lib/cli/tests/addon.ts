import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { AddonSpec, sanitizeAddons } from '../add/index.ts';

const testCwd = '/test/project';

describe('sanitizeAddons', () => {
	it('should find official addon', () => {
		const result = sanitizeAddons([{ id: 'eslint' }], testCwd);
		expect(result).toHaveLength(1);
		expect(result[0]).toBeInstanceOf(AddonSpec);
		expect(result[0].specifier).toBe('eslint');
		expect(result[0].id).toBe('eslint');
		expect(result[0].kind).toBe('official');
		expect(result[0].options).toEqual([]);
	});
	it('should find official addon with alias', () => {
		const result = sanitizeAddons([{ id: 'tailwind' }], testCwd);
		expect(result).toHaveLength(1);
		expect(result[0].specifier).toBe('tailwind');
		expect(result[0].id).toBe('tailwindcss');
		expect(result[0].kind).toBe('official');
	});
	it('should have 2', () => {
		const result = sanitizeAddons([{ id: 'eslint' }, { id: 'tailwindcss' }], testCwd);
		expect(result).toHaveLength(2);
		expect(result[0].id).toBe('eslint');
		expect(result[1].id).toBe('tailwindcss');
	});
	it('should dedupe even with alias', () => {
		const result = sanitizeAddons([{ id: 'tailwind' }, { id: 'tailwindcss' }], testCwd);
		expect(result).toHaveLength(1);
		expect(result[0].id).toBe('tailwindcss');
	});
	it('should find file addons', () => {
		const result = sanitizeAddons([{ id: 'file:../' }], testCwd);
		expect(result).toHaveLength(1);
		expect(result[0].specifier).toBe('file:../');
		expect(result[0].id).toBe('file:../');
		expect(result[0].kind).toBe('file');
		expect(result[0].filePath).toBe(path.resolve(testCwd, '../'));
	});
	it('should provide error hints based on kind', () => {
		const [official] = sanitizeAddons([{ id: 'eslint' }], testCwd);
		expect(official.getErrorHint()).toContain('github.com/sveltejs/cli');

		const [file] = sanitizeAddons([{ id: 'file:../' }], testCwd);
		expect(file.getErrorHint()).toContain('local add-on');

		const [npm] = sanitizeAddons([{ id: '@supacool' }], testCwd);
		expect(npm.getErrorHint()).toContain('npmjs.com');
	});
});
