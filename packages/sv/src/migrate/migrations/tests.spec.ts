import fs from 'node:fs';
import path, { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';
import { prepareSvApi } from '../../core/engine.ts';
import { createWorkspace } from '../../core/workspace.ts';

const baseDir = resolve(fileURLToPath(import.meta.url), '..');
const migrationDirectories = getDirectoryNames(baseDir);
const tasksDirectoryName = 'tasks';
const testsDirectoryName = 'tests';

for (const migrationDirectory of migrationDirectories) {
	const testNames = getFileNames(path.join(baseDir, migrationDirectory, tasksDirectoryName));
	if (testNames.length === 0) continue;

	describe(migrationDirectory, () => {
		for (const testName of testNames) {
			test(testName, async () => {
				const cwd = path.join(baseDir, migrationDirectory, testsDirectoryName, testName);

				const workspace = await createWorkspace({
					cwd,
					packageManager: 'pnpm',
					override: {
						dependencies: {
							vite: '^8.0.0',
							'@sveltejs/vite-plugin-svelte': '^7.0.0',
							svelte: '^5.48.0',
							typescript: '^6.0.0' // TS projects only
						}
					}
				});
				const modifiedFiles = new Set<string>();
				const { sv, updateDependencies } = prepareSvApi(workspace, modifiedFiles, {
					saveFileInfix: '.actual'
				});

				const module = await import(`./${migrationDirectory}/${tasksDirectoryName}/${testName}`);
				await module.default.run({
					sv,
					...workspace
				});

				updateDependencies();

				for (const file of modifiedFiles) {
					const actual = fs.readFileSync(path.join(cwd, file), 'utf-8');
					const expectedFileName = file.replace('.actual', '.snapshot');
					const expectedPath = path.join(cwd, expectedFileName);
					await expect(actual).toMatchFileSnapshot(expectedPath, expectedFileName);
				}
			});
		}
	});
}

function getFileNames(dir: string) {
	if (!fs.existsSync(dir)) return [];

	return fs
		.readdirSync(dir, { withFileTypes: true })
		.filter((dirent) => dirent.isFile())
		.map((dirent) => dirent.name.replace('.ts', ''));
}

function getDirectoryNames(dir: string) {
	if (!fs.existsSync(dir)) return [];

	return fs
		.readdirSync(dir, { withFileTypes: true })
		.filter((dirent) => dirent.isDirectory())
		.map((dirent) => dirent.name);
}
