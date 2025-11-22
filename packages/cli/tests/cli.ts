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
	it('should be able to create a new project with cli command', async () => {
		const svBinPath = path.resolve(monoRepoPath, 'packages', 'cli', 'dist', 'bin.js');
		const testOutputPath = path.resolve(monoRepoPath, '.test-output', 'cli', 'test-project');

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
				'--no-add-ons'
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
		expect(packageJson.name).toBe('test-project');
	});
});
