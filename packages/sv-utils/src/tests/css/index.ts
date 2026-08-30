import fs from 'node:fs';
import { join } from 'node:path';
import { format } from 'oxfmt';
import { describe, expect, test } from 'vitest';
import oxfmtConfig from '../../../../../oxfmt.config.ts';
import { parseCss, serializeCss } from '../../tooling/index.ts';

const baseDir = import.meta.dirname;
const categoryDirectories = getDirectoryNames(baseDir);

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
				module.run(ast);

				const output = serializeCss(ast);
				const formattedOutput = (await format('output.css', output, oxfmtConfig)).code;
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
