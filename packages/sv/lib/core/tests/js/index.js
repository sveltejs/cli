import fs from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';
import { parseScript, serializeScript } from '../../tooling/index.js';

const baseDir = resolve(fileURLToPath(import.meta.url), '..');
const categoryDirectories = getDirectoryNames(baseDir);

for (const categoryDirectory of categoryDirectories) {
	describe(categoryDirectory, () => {
		const testNames = getDirectoryNames(join(baseDir, categoryDirectory));
		for (const testName of testNames) {
			test(testName, async () => {
				const testDirectoryPath = join(baseDir, categoryDirectory, testName);

				const inputFilePath = join(testDirectoryPath, 'input.ts');
				const input = fs.existsSync(inputFilePath) ? fs.readFileSync(inputFilePath, 'utf8') : '';
				const { ast, comments } = parseScript(input);

				// dynamic imports always need to provide the path inline for static analysis
				const module = await import(`./${categoryDirectory}/${testName}/run.js`);
				module.run(ast, comments);

				let output = serializeScript(ast, comments, input);
				if (!output.endsWith('\n')) output += '\n';
				await expect(output).toMatchFileSnapshot(`${testDirectoryPath}/output.ts`);
			});
		}
	});
}

/**
 * @param {string} dir
 */
function getDirectoryNames(dir) {
	return fs
		.readdirSync(dir, { withFileTypes: true })
		.filter((dirent) => dirent.isDirectory())
		.map((dirent) => dirent.name);
}
