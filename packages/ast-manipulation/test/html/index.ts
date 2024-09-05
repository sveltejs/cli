import { describe, expect, test } from 'vitest';
import { parseHtml, serializeHtml } from '@svelte-cli/ast-tooling';
import { getHtmlAstEditor } from '@svelte-cli/ast-manipulation';
import fs from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const baseDir = resolve(fileURLToPath(import.meta.url), '..');
const categoryDirectories = getDirectoryNames(baseDir);

for (const categoryDirectory of categoryDirectories) {
	describe(categoryDirectory, () => {
		const testNames = getDirectoryNames(join(baseDir, categoryDirectory));
		for (const testName of testNames) {
			test(testName, async () => {
				const testDirectoryPath = join(baseDir, categoryDirectory, testName);

				const inputFilePath = join(testDirectoryPath, 'input.html');
				const input = fs.existsSync(inputFilePath) ? fs.readFileSync(inputFilePath) : '';
				const ast = parseHtml(input.toString());
				const editor = getHtmlAstEditor(ast);

				// dynamic imports always need to provide the path inline for static analysis
				const module = await import(`./${categoryDirectory}/${testName}/run.ts`);
				module.run(editor);

				const output = serializeHtml(ast);
				await expect(output).toMatchFileSnapshot(`${testDirectoryPath}/output.html`);
			});
		}
	});
}

function getDirectoryNames(dir: string) {
	return fs
		.readdirSync(dir, { withFileTypes: true })
		.filter((dirent) => dirent.isDirectory())
		.map((dirent) => dirent.name);
}
