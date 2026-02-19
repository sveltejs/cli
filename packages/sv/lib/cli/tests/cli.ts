import fs from 'node:fs';
import path from 'node:path';
import { exec } from 'tinyexec';
import { beforeAll, describe, expect, it } from 'vitest';
import { parse } from '../../core.ts';

const monoRepoPath = path.resolve(__dirname, '..', '..', '..', '..', '..');
const svBinPath = path.resolve(monoRepoPath, 'packages', 'sv', 'dist', 'bin.mjs');
const testOutputCliPath = path.resolve(monoRepoPath, 'packages', 'sv', '.test-output', 'cli');

beforeAll(() => {
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
				'better-auth=demo:password,github',
				'mdsvex',
				'paraglide=languageTags:en,es+demo:yes',
				'mcp=ide:claude-code,cursor,gemini,opencode,vscode,other+setup:local'
				// 'storybook' // No storybook addon during tests!
			]
		},
		{
			projectName: '@my-org/sv',
			template: 'addon',
			args: []
		}
	];

	it.for(testCases)(
		'should create a new project with name $projectName',
		{ timeout: 51_000 },
		async (testCase) => {
			const { projectName, args, template = 'minimal' } = testCase;

			const testOutputPath = path.relative(
				monoRepoPath,
				path.resolve(testOutputCliPath, projectName)
			);

			const allArgs = [
				svBinPath,
				'create',
				testOutputPath,
				'--template',
				template,
				...(template === 'addon' ? [] : ['--types', 'ts']),
				'--no-install',
				...args
			];

			// useful for debugging
			// console.log(`command`, `node ${allArgs.join(' ')}`);
			const result = await exec('node', allArgs, { nodeOptions: { stdio: 'pipe' } });

			// cli finished well
			expect(
				result.exitCode,
				`Error with cli:\n  cmd: node ${allArgs.join(' ')}\n  stdout: ${result.stdout}\n  stderr: ${result.stderr}`
			).toBe(0);
			// test output path exists
			expect(fs.existsSync(testOutputPath)).toBe(true);

			// package.json has a name
			const packageJsonPath = path.resolve(testOutputPath, 'package.json');
			const { data: packageJson } = parse.json(fs.readFileSync(packageJsonPath, 'utf-8'));
			expect(packageJson.name).toBe(projectName);

			const snapPath = path.resolve(
				monoRepoPath,
				'packages',
				'sv',
				'lib',
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
					const { data: generatedPackageJson } = parse.json(generated);
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

			if (template === 'addon') {
				// replace sv version in package.json for tests
				const packageJsonPath = path.resolve(testOutputPath, 'package.json');
				const { data: packageJson } = parse.json(fs.readFileSync(packageJsonPath, 'utf-8'));
				packageJson.dependencies['sv'] = 'file:../../../..';
				fs.writeFileSync(
					packageJsonPath,
					JSON.stringify(packageJson, null, 3).replaceAll('   ', '\t')
				);

				const cmds = [
					// list of cmds to test
					['i'],
					['run', 'demo-create'],
					['run', 'demo-add:ci'],
					['run', 'test']
				];
				for (const cmd of cmds) {
					const res = await exec('npm', cmd, {
						nodeOptions: { stdio: 'pipe', cwd: testOutputPath }
					});
					expect(
						res.exitCode,
						`Error addon test: '${cmd}' -> ${JSON.stringify(res, null, 2)}`
					).toBe(0);
				}
			}
		}
	);
});
