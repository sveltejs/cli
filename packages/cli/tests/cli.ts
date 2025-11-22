import { beforeAll, describe, expect, it } from 'vitest';

import { exec } from 'tinyexec';
import path from 'node:path';
import fs from 'node:fs';
import { parseJson } from '../../core/tooling/index.ts';

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
			]
		}
	];

	it.for(testCases)('should create a new project with name $projectName', async (testCase) => {
		const { projectName, args } = testCase;
		const svBinPath = path.resolve(monoRepoPath, 'packages', 'cli', 'dist', 'bin.js');
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
			{ nodeOptions: { stdio: 'ignore' } }
		);

		// cli finished well
		expect(result.exitCode).toBe(0);

		// test output path exists
		expect(fs.existsSync(testOutputPath)).toBe(true);

		// package.json has a name
		const packageJsonPath = path.resolve(testOutputPath, 'package.json');
		const packageJson = parseJson(fs.readFileSync(packageJsonPath, 'utf-8'));
		expect(packageJson.name).toBe(projectName);
	});
});
