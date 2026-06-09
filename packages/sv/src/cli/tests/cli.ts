import { parse } from '@sveltejs/sv-utils';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { exec } from 'tinyexec';
import { beforeAll, describe, expect, it } from 'vitest';

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
				'drizzle=database:sqlite+sqlite:libsql',
				'better-auth=demo:password,github',
				'mdsvex',
				'paraglide=languageTags:en,es+demo:yes',
				'mcp=ide:claude-code,cursor,gemini,opencode,vscode,other+setup:local'
				// 'storybook' // No storybook addon during tests!
			]
		},
		{
			projectName: 'create-experimental',
			args: [
				'--add',
				'sveltekit-adapter=adapter:cloudflare+cfTarget:workers',
				'drizzle=database:sqlite+sqlite:libsql',
				'better-auth=demo:password,github',
				'experimental=versions:+features:explicitEnvironmentVariables'
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
		{ timeout: 123_000 },
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
				'src',
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
					// Normalize workspace package versions to avoid snapshot drift on version bumps
					for (const pkg of ['sv', '@sveltejs/sv-utils']) {
						if (generatedPackageJson.peerDependencies?.[pkg]) {
							generatedPackageJson.peerDependencies[pkg] = '^0.0.0';
						}
						if (generatedPackageJson.devDependencies?.[pkg]) {
							generatedPackageJson.devDependencies[pkg] = '^0.0.0';
						}
					}
					generated = JSON.stringify(generatedPackageJson, null, 3).replaceAll('   ', '\t');
				}

				generated = generated.replaceAll('\r\n', '\n'); // make it work on Windows too
				if (!generated.endsWith('\n')) generated += '\n'; // ensure trailing newline

				// Normalize sv version in README.md to avoid snapshot drift
				if (relativeFile === 'README.md') {
					generated = generated.replace(/sv@\d+\.\d+\.\d+/g, 'sv@0.0.0');
				}

				// Normalize the cloudflare adapter's `compatibility_date` (set to today) to avoid daily drift
				if (relativeFile === 'wrangler.jsonc') {
					generated = generated.replace(
						/"compatibility_date": "\d{4}-\d{2}-\d{2}"/,
						'"compatibility_date": "2020-01-01"'
					);
				}

				await expect(generated).toMatchFileSnapshot(
					path.resolve(snapPath, relativeFile),
					`file "${relativeFile}" does not match snapshot`
				);
			}

			if (projectName === 'create-with-all-addons' && process.platform !== 'win32') {
				const installResult = await exec('pnpm', ['install', '--no-frozen-lockfile'], {
					nodeOptions: { stdio: 'pipe', cwd: testOutputPath }
				});
				expect(
					installResult.exitCode,
					`pnpm install failed:\n  stdout: ${installResult.stdout}\n  stderr: ${installResult.stderr}`
				).toBe(0);
				await exec('pnpm', ['build'], {
					nodeOptions: { stdio: 'pipe', cwd: testOutputPath }
				});
				await exec('pnpm', ['auth:schema'], {
					nodeOptions: { stdio: 'pipe', cwd: testOutputPath }
				});
				const check = await exec('pnpm', ['check'], {
					nodeOptions: { stdio: 'pipe', cwd: testOutputPath }
				});
				expect(
					check.exitCode,
					`svelte-check failed:\n  stdout: ${check.stdout}\n  stderr: ${check.stderr}`
				).toBe(0);
			}

			if (projectName === 'create-experimental') {
				const read = (p: string) => fs.readFileSync(path.resolve(testOutputPath, p), 'utf-8');
				const envFile = read('src/env.ts');
				expect(envFile).toContain('defineEnvVars');
				expect(envFile).toContain('DATABASE_URL');
				expect(read('src/lib/server/db/index.ts')).toContain("from '$app/env/private'");
				expect(read('src/lib/server/auth.ts')).toContain("from '$app/env/private'");
				expect(read('src/lib/server/db/index.ts')).not.toContain('$env/dynamic/private');
			}

			if (template === 'addon') {
				// replace sv and sv-utils versions in package.json for tests
				const packageJsonPath = path.resolve(testOutputPath, 'package.json');
				const { data: packageJson } = parse.json(fs.readFileSync(packageJsonPath, 'utf-8'));
				packageJson.peerDependencies['sv'] = 'file:../../../..';
				packageJson.devDependencies['sv'] = 'file:../../../..';
				packageJson.devDependencies['@sveltejs/sv-utils'] = 'file:../../../../../sv-utils';
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
					// use npm here so the install doesn't walk up into the monorepo's
					// pnpm workspace and try to resolve packages from there
					const res = await exec('npm', cmd, {
						nodeOptions: {
							stdio: 'pipe',
							cwd: testOutputPath,
							env: {
								...process.env,
								// allow npm under a repo whose packageManager is pnpm
								COREPACK_ENABLE_STRICT: '0'
							}
						}
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
