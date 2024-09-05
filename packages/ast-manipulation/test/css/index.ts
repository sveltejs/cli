import { describe, expect, test } from 'vitest';
import { parsePostcss, serializePostcss } from '@svelte-cli/ast-tooling';
import { getCssAstEditor } from '@svelte-cli/ast-manipulation';
import { readdir, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const baseDir = resolve(fileURLToPath(import.meta.url), '..');
const categoryDirectories = await getDirectoryNames(baseDir);

for (const categoryDirectory of categoryDirectories) {
	describe(categoryDirectory, async () => {
		const testNames = await getDirectoryNames(join(baseDir, categoryDirectory));
		for (const testName of testNames) {
			test(testName, async () => {
				const testDirectoryPath = join(baseDir, categoryDirectory, testName);

				const input = await readFile(join(testDirectoryPath, 'input.css'));
				const ast = parsePostcss(input.toString());
				const editor = getCssAstEditor(ast);

				// dynamic imports always need to provide the path inline for static analysis
				const module = await import(`./${categoryDirectory}/${testName}/run.ts`);
				module.run(editor);

				const output = serializePostcss(ast);
				await expect(output).toMatchFileSnapshot(`${testDirectoryPath}/output.css`);
			});
		}
	});
}

async function getDirectoryNames(dir: string) {
	return (await readdir(dir, { withFileTypes: true }))
		.filter((dirent) => dirent.isDirectory())
		.map((dirent) => dirent.name);
}