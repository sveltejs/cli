import fs from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import prettier from 'prettier';
import { describe, expect, test } from 'vitest';
import { parseCss, serializeCss } from '@sveltejs/ast-tooling';

const baseDir = resolve(fileURLToPath(import.meta.url), '..');
const categoryDirectories = getDirectoryNames(baseDir);

const prettierConfig = await prettier.resolveConfig(import.meta.url);
if (!prettierConfig) throw new Error('Failed to resolve prettier config');
prettierConfig.filepath = 'output.css';

for (const categoryDirectory of categoryDirectories) {
	describe(categoryDirectory, () => {
		const testNames = getDirectoryNames(join(baseDir, categoryDirectory));
		for (const testName of testNames) {
			test(testName, async () => {
				const testDirectoryPath = join(baseDir, categoryDirectory, testName);

				const inputFilePath = join(testDirectoryPath, 'input.css');
				const input = fs.existsSync(inputFilePath) ? fs.readFileSync(inputFilePath) : '';
				const ast = parseCss(input.toString());

				// dynamic imports always need to provide the path inline for static analysis
				const module = await import(`./${categoryDirectory}/${testName}/run.ts`);
				module.run({ ast });

				const output = serializeCss(ast);
				const formattedOutput = await prettier.format(output, prettierConfig);
				await expect(formattedOutput).toMatchFileSnapshot(`${testDirectoryPath}/output.css`);
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
