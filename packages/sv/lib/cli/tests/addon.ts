import { describe, expect, it } from 'vitest';
import { sanitizeAddons } from '../add/index.ts';

describe('sanitizeAddons', () => {
	it('should find official addon', () => {
		expect(sanitizeAddons([{ id: 'eslint' }])).toEqual([
			{ id: 'eslint', options: [], kind: 'official' }
		]);
	});
	it('should find official addon with alias', () => {
		expect(sanitizeAddons([{ id: 'tailwind' }])).toEqual([
			{ id: 'tailwindcss', options: [], kind: 'official' }
		]);
	});
	it('should have 2', () => {
		expect(sanitizeAddons([{ id: 'eslint' }, { id: 'tailwindcss' }])).toEqual([
			{ id: 'eslint', options: [], kind: 'official' },
			{ id: 'tailwindcss', options: [], kind: 'official' }
		]);
	});
	it('should dedupe even with alias', () => {
		expect(sanitizeAddons([{ id: 'tailwind' }, { id: 'tailwindcss' }])).toEqual([
			{ id: 'tailwindcss', options: [], kind: 'official' }
		]);
	});
	it('should find file addons', () => {
		expect(sanitizeAddons([{ id: 'file:../' }])).toEqual([
			{ id: 'file:../', options: [], kind: 'file' }
		]);
	});
});
