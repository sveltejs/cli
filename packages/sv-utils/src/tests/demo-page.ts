import { describe, expect, test } from 'vitest';
import { defineDemoPage } from '../demo-page.ts';

const kitRoutes = 'src/routes';

function fakeSv(files: Record<string, string> = {}) {
	return {
		files,
		file(path: string, edit: (content: string) => string | false) {
			const out = edit(files[path] ?? '');
			if (out !== false) files[path] = out;
		}
	};
}

function runAddon(sv: ReturnType<typeof fakeSv>, name: string) {
	const demo = defineDemoPage(name, 'ts', kitRoutes);
	sv.file(...demo.listing);
	sv.file(...demo.header);
}

const count = (content: string, needle: string) => content.split(needle).length - 1;

describe('defineDemoPage', () => {
	test('same add-on twice does not duplicate links', () => {
		const sv = fakeSv();
		runAddon(sv, 'x');
		runAddon(sv, 'x');

		const files = Object.values(sv.files).join('\n');
		expect(count(files, "'/demo/x'")).toBe(1);
	});

	test('x, y, z, then x/y/z again: one link each', () => {
		const sv = fakeSv();
		for (const name of ['x', 'y', 'z', 'x', 'y', 'z']) runAddon(sv, name);

		const files = Object.values(sv.files).join('\n');
		for (const name of ['x', 'y', 'z']) {
			expect(count(files, `'/demo/${name}'`)).toBe(1);
		}
	});
});
