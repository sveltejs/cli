import { beforeAll, describe, expect, it } from 'vitest';

import { exec } from 'tinyexec';
import path from 'node:path';
import fs from 'node:fs';
import { parseJson } from '../lib/core/tooling/index.ts';

const monoRepoPath = path.resolve(__dirname, '..', '..', '..');

beforeAll(() => {
	const testOutputCliPath = path.resolve(monoRepoPath, '.test-output', 'cli');

	if (fs.existsSync(testOutputCliPath)) {
		fs.rmSync(testOutputCliPath, { force: true, recursive: true });
	}
});

describe('cli', () => {
	const testCases = [
		{ projectName: 'create-only', args: ['--no-add-ons'] },
		{
			projectName: 'create-with-all-addons',
			args: [
				'--add',
				'prettier',
				'eslint',
				'vitest=usages:unit,component',
				'playwright',
				'tailwindcss=plugins:typography,forms',
				'sveltekit-adapter=adapter:node',
				'devtools-json',
				'drizzle=database:sqlite+sqlite:libsql',
				'lucia=demo:yes',
				'mdsvex',
				'paraglide=languageTags:en,es+demo:yes',
				'mcp=ide:claude-code,cursor,gemini,opencode,vscode,other+setup:local'
				// 'storybook' // No storybook addon during tests!
			]
		}
	];

	it.for(testCases)(
		'should create a new project with name $projectName',
		{ timeout: 10_000 },
		async (testCase) => {
			const { projectName, args } = testCase;
			const svBinPath = path.resolve(monoRepoPath, 'packages', 'sv', 'dist', 'bin.mjs');
			const testOutputPath = path.resolve(monoRepoPath, '.test-output', 'cli', projectName);

			const result = await exec(
				'node',
				[
					svBinPath,
					'create',
					testOutputPath,
					'--template',
					'minimal',
					'--types',
					'ts',
					'--no-install',
					...args
				],
				{ nodeOptions: { stdio: 'pipe' } }
			);

			// cli finished well
			expect(result.exitCode).toBe(0);

			// test output path exists
			expect(fs.existsSync(testOutputPath)).toBe(true);

			// package.json has a name
			const packageJsonPath = path.resolve(testOutputPath, 'package.json');
			const packageJson = parseJson(fs.readFileSync(packageJsonPath, 'utf-8'));
			expect(packageJson.name).toBe(projectName);

			const snapPath = path.resolve(
				monoRepoPath,
				'packages',
				'cli',
				'tests',
				'snapshots',
				projectName
			);
			const relativeFiles = fs.readdirSync(testOutputPath, { recursive: true }) as string[];
			for (const relativeFile of relativeFiles) {
				if (!fs.statSync(path.resolve(testOutputPath, relativeFile)).isFile()) continue;
				if (['.svg', '.env'].some((ext) => relativeFile.endsWith(ext))) continue;

				let generated = fs.readFileSync(path.resolve(testOutputPath, relativeFile), 'utf-8');
				if (relativeFile === 'package.json') {
					const generatedPackageJson = parseJson(generated);
					// remove @types/node from generated package.json as we test on different node versions
					delete generatedPackageJson.devDependencies['@types/node'];
					generated = JSON.stringify(generatedPackageJson, null, 3).replaceAll('   ', '\t');
				}

				generated = generated.replaceAll('\r\n', '\n'); // make it work on Windows too
				if (!generated.endsWith('\n')) generated += '\n'; // ensure trailing newline

				await expect(generated).toMatchFileSnapshot(
					path.resolve(snapPath, relativeFile),
					`file "${relativeFile}" does not match snapshot`
				);
			}
		}
	);
});
