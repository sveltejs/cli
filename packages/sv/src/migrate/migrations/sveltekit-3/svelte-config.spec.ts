import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, test } from 'vitest';
import type { SvApi } from '../../../core/config.ts';
import svelteConfigTask from './tasks/svelte-config.ts';

async function migrateViteConfig(content: string): Promise<string> {
	const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'sv-svelte-config-'));
	const configPath = path.join(cwd, 'vite.config.js');
	fs.writeFileSync(configPath, content);

	let result = content;
	const sv = {
		file(file: string, edit: (content: string) => string | false) {
			const original = fs.readFileSync(path.join(cwd, file), 'utf8');
			const edited = edit(original);
			result = edited === false ? original : edited;
		}
	} as SvApi;

	try {
		await svelteConfigTask.run({ cwd, sv } as never);
		return result;
	} finally {
		fs.rmSync(cwd, { recursive: true, force: true });
	}
}

describe('svelte-config: removeFilesLib', () => {
	test('drops files.lib and the now-empty files option', async () => {
		const result = await migrateViteConfig(`
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [sveltekit({ files: { lib: 'src/foo' } })]
});
`);
		expect(result).not.toContain('files');
		expect(result).toContain('sveltekit({})');
	});

	test('keeps sibling files options', async () => {
		const result = await migrateViteConfig(`
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [sveltekit({ files: { lib: 'src/foo', assets: 'static' } })]
});
`);
		expect(result).toMatch(/files:\s*{\s*assets:\s*'static'\s*}/);
	});

	test('handles an aliased import and edits the exported plugin instead of a stray call', async () => {
		const result = await migrateViteConfig(`
import { sveltekit as kit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

const unused = kit({ files: { lib: 'unused' } });

export default defineConfig({
	plugins: [enabled && kit({ files: { lib: 'src/foo', assets: 'static' } })]
});
`);
		expect(result).toMatch(/const unused = kit\(\{ files: \{ lib: 'unused' \} \}\)/);
		expect(result).toMatch(/plugins:\s*\[enabled && kit\(\{ files: \{ assets: 'static' \} \}\)\]/);
		expect(result.match(/\blib:/g)).toHaveLength(1);
	});

	test('removes quoted and statically computed property keys', async () => {
		const result = await migrateViteConfig(`
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [sveltekit({ ['files']: { ['lib']: 'src/foo', assets: 'static' } })]
});
`);
		expect(result).not.toContain("['lib']");
		expect(result).toContain("['files']: { assets: 'static' }");
	});

	test('does not treat dynamic computed keys as files.lib', async () => {
		const content = `
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

const files = 'files';
const lib = 'lib';

export default defineConfig({
	plugins: [sveltekit({ [files]: { [lib]: 'src/foo' } })]
});
`;
		expect(await migrateViteConfig(content)).toBe(content);
	});

	test('ignores lib options outside the sveltekit call', async () => {
		const content = `
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	test: { files: { lib: 'src/foo' } },
	plugins: [sveltekit({ adapter: 'x' })]
});
`;
		expect(await migrateViteConfig(content)).toBe(content);
	});
});
