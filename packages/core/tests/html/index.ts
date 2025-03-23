import fs from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import prettier from 'prettier';
import { describe, expect, test } from 'vitest';
import { parseHtml, serializeHtml } from '../../tooling/tools.ts';

const baseDir = resolve(fileURLToPath(import.meta.url), '..');
const categoryDirectories = getDirectoryNames(baseDir);

const prettierConfig = await prettier.resolveConfig(import.meta.url);
if (!prettierConfig) throw new Error('Failed to resolve prettier config');
prettierConfig.filepath = 'output.html';

for (const categoryDirectory of categoryDirectories) {
	describe(categoryDirectory, () => {
		const testNames = getDirectoryNames(join(baseDir, categoryDirectory));
		for (const testName of testNames) {
			test(testName, async () => {
				const testDirectoryPath = join(baseDir, categoryDirectory, testName);

				const inputFilePath = join(testDirectoryPath, 'input.html');
				const input = fs.existsSync(inputFilePath) ? fs.readFileSync(inputFilePath) : '';
				const ast = parseHtml(input.toString());

				// dynamic imports always need to provide the path inline for static analysis
				const module = await import(`./${categoryDirectory}/${testName}/run.ts`);
				module.run(ast);

				const output = serializeHtml(ast);
				const formattedOutput = await prettier.format(output, prettierConfig);
				await expect(formattedOutput).toMatchFileSnapshot(`${testDirectoryPath}/output.html`);
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
