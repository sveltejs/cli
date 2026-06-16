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
const defaultDependencies = {
	vite: '^8.0.0',
	'@sveltejs/vite-plugin-svelte': '^7.0.0',
	svelte: '^5.48.0',
	typescript: '^6.0.0' // TS projects only
};

for (const migrationDirectory of migrationDirectories) {
	const testNames = getFileNames(path.join(baseDir, migrationDirectory, tasksDirectoryName));
	if (testNames.length === 0) continue;

	describe(migrationDirectory, () => {
		for (const testName of testNames) {
			test(testName, async () => {
				const cwd = path.join(baseDir, migrationDirectory, testsDirectoryName, testName);

				// cleanup old test run by deleting old actual files
				const oldActualFiles = fs.globSync('**/*.actual.*', {
					cwd
				});
				for (const oldActualFile of oldActualFiles) {
					fs.rmSync(path.join(cwd, oldActualFile));
				}

				// copy template files to non template files.
				copyTemplateFiles(cwd);

				// prepare the workspace
				const workspace = await createWorkspace({
					cwd,
					packageManager: 'pnpm',

					// only add the default dependencies if there is no package.json
					...(fs.existsSync(path.join(cwd, 'package.json'))
						? {}
						: { override: { dependencies: defaultDependencies } })
				});
				const modifiedFiles = new Set<string>();
				const { sv, updateDependencies } = prepareSvApi(workspace, modifiedFiles, {
					saveFileInfix: '.actual',
					// exclude snapshot and actual files to avoid them being modified by the migration
					additionalExcludes: ['**/*.snapshot.*', '**/*.actual.*']
				});

				// run the migration task
				const module = await import(
					// file extension must be static for the dynamic imports to work, so we remove it from the test name and add it back here.
					`./${migrationDirectory}/${tasksDirectoryName}/${testName.replace('.ts', '')}.ts`
				);
				await module.default.run({
					sv,
					...workspace
				});

				updateDependencies();

				if (modifiedFiles.size === 0) {
					throw new Error('No files were modified by the migration.');
				}

				const remainingSnapshotFiles = fs.globSync('**/*.snapshot.*', {
					cwd
				});

				// compare modified files against snapshots
				for (const file of modifiedFiles) {
					const actualPath = path.join(cwd, file);
					const actual = fs.readFileSync(actualPath, 'utf-8');

					const expectedFileName = file.replace('.actual', '.snapshot');
					const expectedPath = path.join(cwd, expectedFileName);
					await expect(actual).toMatchFileSnapshot(expectedPath, expectedFileName);

					remainingSnapshotFiles.splice(remainingSnapshotFiles.indexOf(expectedFileName), 1);
				}

				// if we have any snapshots remaining that were not tested against, fail the test to make sure all snapshots are up to date and tested against.
				// Either delete the snapshot if it's no longer needed, or add a test file that modifies it if it's still needed.
				if (remainingSnapshotFiles.length > 0) {
					throw new Error(
						`The following snapshot files were not tested against: ${remainingSnapshotFiles.join(', ')}`
					);
				}
			});
		}
	});
}

/**
 * Some files might be deleted by migrations, but required to test the migration each time.
 * That's why we keep those template files which are copied before each test run
 * and can be used for the migration to wor on.
 */
function copyTemplateFiles(dir: string) {
	if (!fs.existsSync(dir)) return;

	const templateFiles = fs.globSync('**/*.template.*', {
		cwd: dir,
		exclude: ['node_modules/**', '**/node_modules/**']
	});

	for (const templateFile of templateFiles) {
		const targetFile = templateFile.replace('.template.', '.');
		fs.copyFileSync(path.join(dir, templateFile), path.join(dir, targetFile));
	}
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
