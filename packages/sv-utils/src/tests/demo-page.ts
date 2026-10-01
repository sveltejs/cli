import { describe, expect, test } from 'vitest';
import { defineDemoPage } from '../demo-page.ts';

const kitRoutes = 'src/routes';
const LINKS = `${kitRoutes}/demo/DemoLinks.svelte`;
const LAYOUT = `${kitRoutes}/+layout.svelte`;

function fakeSv(files: Record<string, string> = {}) {
	return {
		files,
		file(path: string, edit: (content: string) => string | false) {
			const out = edit(files[path] ?? '');
			if (out !== false) files[path] = out;
		}
	};
}

function runAddon(sv: ReturnType<typeof fakeSv>, name: string, language: 'ts' | 'js' = 'ts') {
	const demo = defineDemoPage(name, language, kitRoutes);
	sv.file(...demo.links);
	sv.file(...demo.layout);
}

const count = (content: string, needle: string) => content.split(needle).length - 1;

describe('defineDemoPage', () => {
	test('same add-on twice does not duplicate links', () => {
		const sv = fakeSv();
		runAddon(sv, 'x');
		runAddon(sv, 'x');

		expect(count(sv.files[LINKS], "href={resolve('/demo/x')}")).toBe(1);
		expect(count(sv.files[LAYOUT], '<DemoLinks />')).toBe(1);
	});

	test('x, y, z, then x/y/z again: one link each', () => {
		const sv = fakeSv();
		for (const name of ['x', 'y', 'z', 'x', 'y', 'z']) runAddon(sv, name);

		for (const name of ['x', 'y', 'z']) {
			expect(count(sv.files[LINKS], `href={resolve('/demo/${name}')}`)).toBe(1);
		}
		expect(count(sv.files[LAYOUT], '<DemoLinks />')).toBe(1);
		expect(count(sv.files[LAYOUT], 'import DemoLinks')).toBe(1);
		expect(sv.files[LINKS]).toMatchSnapshot();
	});

	test('js: single `resolve` import', () => {
		const sv = fakeSv();
		for (const name of ['x', 'y', 'x']) runAddon(sv, name, 'js');

		expect(count(sv.files[LINKS], 'import { resolve }')).toBe(1);
		expect(count(sv.files[LAYOUT], 'import DemoLinks')).toBe(1);
	});

	test('upserts into an existing layout', () => {
		const sv = fakeSv({
			[LAYOUT]:
				'<script lang="ts">\n\tlet { children } = $props();\n</script>\n\n<svelte:head>\n\t<title>x</title>\n</svelte:head>\n\n{@render children()}\n'
		});
		runAddon(sv, 'x');
		expect(sv.files[LAYOUT]).toMatchSnapshot();
	});
});
