import { describe, expect, test } from 'vitest';
import { removeFilesLib } from './tasks/svelte-config.ts';

describe('svelte-config: removeFilesLib', () => {
	test('drops files.lib and the now-empty files option', () => {
		const result = removeFilesLib(`
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [sveltekit({ files: { lib: 'src/foo' } })]
});
`);
		expect(typeof result).toBe('string');
		expect(result).not.toContain('files');
		expect(result).toContain('sveltekit({})');
	});

	test('keeps sibling files options', () => {
		const result = removeFilesLib(`
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [sveltekit({ files: { lib: 'src/foo', assets: 'static' } })]
});
`);
		expect(typeof result).toBe('string');
		expect(result).toMatch(/files:\s*{\s*assets:\s*'static'\s*}/);
	});

	test('ignores lib options outside the sveltekit call', () => {
		const result = removeFilesLib(`
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	test: { files: { lib: 'src/foo' } },
	plugins: [sveltekit({ adapter: 'x' })]
});
`);
		expect(result).toBe(false);
	});

	test('returns false when there is nothing to remove', () => {
		const result = removeFilesLib(`
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [sveltekit()]
});
`);
		expect(result).toBe(false);
	});
});
