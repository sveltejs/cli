import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parse } from '@sveltejs/sv-utils';
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

async function migrateSeparateConfigs(svelte: string, vite: string) {
	const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'sv-svelte-config-'));
	const sveltePath = path.join(cwd, 'svelte.config.ts');
	const vitePath = path.join(cwd, 'vite.config.ts');
	fs.writeFileSync(sveltePath, svelte);
	fs.writeFileSync(vitePath, vite);

	const sv = {
		file(file: string, edit: (content: string) => string | false) {
			const filePath = path.join(cwd, file);
			const original = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '';
			const edited = edit(original);
			if (edited !== false) fs.writeFileSync(filePath, edited);
		},
		removeFile(file: string) {
			fs.rmSync(path.join(cwd, file));
		},
		files() {},
		devDependency() {}
	} as unknown as SvApi;

	try {
		await svelteConfigTask.run({ cwd, sv } as never);
		return {
			svelteConfigExists: fs.existsSync(sveltePath),
			viteConfig: fs.readFileSync(vitePath, 'utf8')
		};
	} finally {
		fs.rmSync(cwd, { recursive: true, force: true });
	}
}

describe('svelte-config: merge configs', () => {
	test('renames a moved top-level binding that already exists in the vite config', async () => {
		const result = await migrateSeparateConfigs(
			`const docs = { base: '/docs' };

const config = { kit: { paths: docs } };

export default config;
`,
			`import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

const docs = () => ({ name: 'docs' });

export default defineConfig({
	plugins: [docs(), sveltekit()]
});
`
		);

		expect(() => parse.script(result.viteConfig)).not.toThrow();
		expect(result.viteConfig).toContain("const docs2 = { base: '/docs' }");
		expect(result.viteConfig).toContain('plugins: [docs(), sveltekit({ paths: docs2 })]');
		expect(result.svelteConfigExists).toBe(false);
	});
});

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
