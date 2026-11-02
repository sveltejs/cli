import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { parse } from '@sveltejs/sv-utils';
import * as find from 'empathic/find';
import { exec } from 'tinyexec';
import { beforeAll, describe, expect, it } from 'vitest';

/** Matches `sv@1.2.3`, `sv@0.0.0-next.0`, `sv@1.0.0-rc.1+build.5`. */
const SV_VERSION_REGEX = /sv@\d+\.\d+\.\d+(?:-[\w.-]+)?(?:\+[\w.-]+)?/g;
const ADAPTER_HINT =
	'To deploy your app, you may need to install an [adapter](https://svelte.dev/docs/kit/adapters) for your target environment.';

const ROOT = path.dirname(find.up('pnpm-workspace.yaml', { cwd: import.meta.dirname })!);
const SV_BIN_PATH = path.resolve(ROOT, 'packages', 'sv', 'dist', 'bin.mjs');
const TEST_DIR = path.resolve(ROOT, 'packages', 'sv', '.test-output', 'cli');
const SNAPSHOTS_DIR = path.resolve(ROOT, 'packages', 'sv', 'src', 'cli', 'tests', 'snapshots');

beforeAll(() => {
	if (fs.existsSync(TEST_DIR)) {
		fs.rmSync(TEST_DIR, { force: true, recursive: true });
	}
});

describe('cli', () => {
	const testCases = [
		{ projectName: 'create-minimal', args: ['--no-add-ons'] },
		{
			projectName: 'create-adapter-auto',
			args: ['--add', 'sveltekit-adapter=adapter:auto'],
			snapshot: false
		},
		{
			projectName: 'create-with-all-addons',
			args: [
				'--add',
				'prettier',
				'eslint',
				'vitest=usages:unit,component',
				'playwright=demo:yes',
				'tailwindcss=plugins:typography,forms',
				'sveltekit-adapter=adapter:node',
				'drizzle=database:sqlite+sqlite:libsql',
				'better-auth=demo:password,github',
				'mdsvex',
				'paraglide=languageTags:en,es+demo:yes',
				'ai-tools=ide:claude-code,cursor,gemini,opencode,vscode,other+delivery:tools+tools:mcp,svelte-code-writer,svelte-core-bestpractices,svelte-file-editor+mcpSetup:local'
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
				'experimental=features:remoteFunctions'
			]
		},
		{
			projectName: '@my-org/sv',
			template: 'addon',
			args: ['--addon-name', '@my-org/sv']
		}
	];

	it.for(testCases)(
		'should create a new project with name $projectName',
		{ timeout: 240_000 },
		async (testCase) => {
			const {
				projectName,
				args,
				template = 'minimal',
				snapshot = true
			} = testCase as {
				projectName: string;
				args: string[];
				template?: string;
				snapshot?: boolean;
			};

			const projectPath = path.relative(ROOT, path.resolve(TEST_DIR, projectName));

			const allArgs = [
				SV_BIN_PATH,
				'create',
				projectPath,
				'--template',
				template,
				...(template === 'addon' ? [] : ['--types', 'ts']),
				'--no-install',
				...args
			];

			/**
			 * Same as `exec`. but `cwd` defaults to `projectPath`
			 */
			const run = (...params: Parameters<typeof exec>) => {
				const [command, args, options = {}] = params;
				options.nodeOptions ??= {};
				options.nodeOptions.cwd ??= projectPath;
				return exec(command, args, options);
			};

			// useful for debugging
			// console.log(`command`, `node ${allArgs.join(' ')}`);
			const result = await exec('node', allArgs);

			// cli finished well
			expect(
				result.exitCode,
				`Error with cli:\n  cmd: node ${allArgs.join(' ')}\n  stdout: ${result.stdout}\n  stderr: ${result.stderr}`
			).toBe(0);
			// test output path exists
			expect(fs.existsSync(projectPath)).toBe(true);

			// package.json has a name
			const packageJsonPath = path.resolve(projectPath, 'package.json');
			const { data: packageJson } = parse.json(fs.readFileSync(packageJsonPath, 'utf-8'));
			expect(packageJson.name).toBe(projectName);

			const readme = fs.readFileSync(path.resolve(projectPath, 'README.md'), 'utf-8');
			if (projectName === 'create-with-all-addons' || projectName === 'create-experimental') {
				expect(readme).not.toContain(ADAPTER_HINT);
			} else if (projectName === 'create-minimal' || projectName === 'create-adapter-auto') {
				expect(readme).toContain(ADAPTER_HINT);
			}

			const snapPath = path.resolve(SNAPSHOTS_DIR, projectName);
			const relativeFiles = snapshot
				? (fs.readdirSync(projectPath, { recursive: true }) as string[])
				: [];

			// Files from ai-tools repo (skills, agents) change independently -
			// snapshot only file listings, not content
			const aiToolsFiles: Record<string, string[]> = {};
			const aiToolsPattern = /[\\/](skills|agents)[\\/]/;

			for (const relativeFile of relativeFiles) {
				if (!fs.statSync(path.resolve(projectPath, relativeFile)).isFile()) continue;
				if (['.svg', '.env'].some((ext) => relativeFile.endsWith(ext))) continue;

				const normalized = relativeFile.replace(/\\/g, '/');

				// Group ai-tools files by directory for manifest comparison
				if (aiToolsPattern.test(normalized)) {
					const match = normalized.match(/(.+\/(?:skills|agents))\/(.*)/);
					if (match) {
						const [, base, rest] = match;
						aiToolsFiles[base] ??= [];
						aiToolsFiles[base].push(rest);
					}
					continue;
				}

				const generated = fs.readFileSync(path.resolve(projectPath, relativeFile), 'utf-8');
				await expect(normalizeGeneratedFile(relativeFile, generated)).toMatchFileSnapshot(
					path.resolve(snapPath, relativeFile),
					`file "${relativeFile}" does not match snapshot`
				);
			}

			// Compare ai-tools file listings against sv-files-snapshots.md manifests
			for (const [dir, files] of Object.entries(aiToolsFiles)) {
				const manifest = files.sort().join('\n') + '\n';
				await expect(manifest).toMatchFileSnapshot(
					path.resolve(snapPath, dir, 'sv-files-snapshots.md'),
					`ai-tools manifest "${dir}" does not match snapshot`
				);
			}

			if (projectName === 'create-with-all-addons' && process.platform !== 'win32') {
				const installResult = await run('pnpm', ['install', '--no-frozen-lockfile']);
				expect(
					installResult.exitCode,
					`pnpm install failed:\n  stdout: ${installResult.stdout}\n  stderr: ${installResult.stderr}`
				).toBe(0);
				await run('pnpm', ['build']);
				await run('pnpm', ['auth:schema']);
				const check = await run('pnpm', ['check']);
				expect(
					check.exitCode,
					`svelte-check failed:\n  stdout: ${check.stdout}\n  stderr: ${check.stderr}`
				).toBe(0);
			}

			if (projectName === 'create-experimental') {
				const read = (p: string) => fs.readFileSync(path.resolve(projectPath, p), 'utf-8');
				const envFile = read('src/env.ts');
				expect(envFile).toContain('defineEnvVars');
				expect(envFile).toContain('DATABASE_URL');
				expect(read('src/lib/server/db/index.ts')).toContain("from '$app/env/private'");
				expect(read('src/lib/server/auth.ts')).toContain("from '$app/env/private'");
				expect(read('src/lib/server/db/index.ts')).not.toContain('$env/dynamic/private');
			}

			if (template === 'addon') {
				// replace sv and sv-utils versions in package.json for tests
				const packageJsonPath = path.resolve(projectPath, 'package.json');
				const { data: packageJson } = parse.json(fs.readFileSync(packageJsonPath, 'utf-8'));
				packageJson.peerDependencies['sv'] = 'file:../../../..';
				packageJson.devDependencies['sv'] = 'file:../../../..';
				packageJson.devDependencies['@sveltejs/sv-utils'] = 'file:../../../../../sv-utils';
				fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, '\t'));

				const cmds = [
					// list of cmds to test
					['i'],
					['run', 'demo-create'],
					['run', 'demo-add:ci'],
					['run', 'test']
				];
				for (const cmd of cmds) {
					const res = await run('npm', cmd, {
						nodeOptions: {
							env: {
								...process.env,
								// tsdown's optional `*` peers crash npm's arborist peer resolver
								// (`edgesOut` null); skip strict peer resolution for this install
								npm_config_legacy_peer_deps: 'true'
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

	const installCases = [
		{ projectName: 'create-minimal-pnpm-11', pnpmVersion: '11.28.10' },
		{ projectName: 'create-minimal-pnpm-10', pnpmVersion: '10.34.9' }
	];

	it.for(installCases)(
		'should create a project and install its dependencies with pnpm $projectName',
		{ timeout: 600_000 },
		async (installCase) => {
			const { projectName, pnpmVersion } = installCase;
			const projectPath = path.relative(ROOT, path.resolve(TEST_DIR, projectName));

			const projectArgs = [
				SV_BIN_PATH,
				'create',
				projectPath,
				'--template',
				'minimal',
				'--types',
				'ts',
				'--no-add-ons',
				'--install',
				'pnpm'
			];

			// CI makes pnpm non-interactive
			const env = { ...process.env, CI: 'true' };
			const result = await exec('node', projectArgs, { nodeOptions: { env } });

			expect(
				result.exitCode,
				`Error with cli:\n  cmd: node ${projectArgs.join(' ')}\n  stdout: ${result.stdout}\n  stderr: ${result.stderr}`
			).toBe(0);
			expect(fs.existsSync(projectPath)).toBe(true);

			const treeFiles: Array<{ relative: string; generated: string }> = [];
			const readTree = (projectDir: string) => {
				for (const relativeFile of fs.readdirSync(projectDir, { recursive: true }) as string[]) {
					if (!fs.statSync(path.resolve(projectDir, relativeFile)).isFile()) continue;
					if (['.svg', '.env'].some((ext) => relativeFile.endsWith(ext))) continue;

					const normalized = relativeFile.replace(/\\/g, '/');
					if (normalized.startsWith('node_modules/')) continue;
					if (relativeFile === 'pnpm-lock.yaml') continue;

					// `.svelte-kit` is generated by `svelte-kit sync` during install and is
					// gitignored in the snapshot dirs, so it can't be compared here
					if (normalized.startsWith('.svelte-kit/')) continue;

					const generated = fs.readFileSync(path.resolve(projectDir, relativeFile), 'utf-8');
					treeFiles.push({
						relative: relativeFile,
						generated: normalizeGeneratedFile(normalized, generated)
					});
				}
			};

			fs.rmSync(path.resolve(projectPath, 'node_modules'), { force: true, recursive: true });
			fs.rmSync(path.resolve(projectPath, 'pnpm-lock.yaml'), { force: true });

			/**
			 * pnpm 10 has no workspace guard, so the install runs
			 * from a copy of the project placed outside the repo
			 */
			const tempBase = fs.mkdtempSync(path.join(os.tmpdir(), 'sv-install-pnpm-'));
			const installedProject = path.join(tempBase, 'project');
			try {
				fs.cpSync(projectPath, installedProject, { recursive: true });
				const install = await exec(
					'pnpm',
					['with', pnpmVersion, 'install', '--no-frozen-lockfile'],
					{ nodeOptions: { cwd: installedProject, env } }
				);
				expect(
					install.exitCode,
					`pnpm install failed:\n  stdout: ${install.stdout}\n  stderr: ${install.stderr}`
				).toBe(0);
				readTree(installedProject);
			} finally {
				fs.rmSync(tempBase, { force: true, recursive: true });
			}

			const snapPath = path.resolve(SNAPSHOTS_DIR, projectName);

			// full tree of the created project, after the install ran — the
			// same files the pre-install cases snapshot, so a template change
			// or post-install file mutation is visible directly in the diff
			for (const { relative, generated } of treeFiles) {
				await expect(generated).toMatchFileSnapshot(
					path.resolve(snapPath, relative),
					`file "${relative}" does not match snapshot`
				);
			}
		}
	);
});

/** Normalizes a generated project file the same way for every snapshot case. */
function normalizeGeneratedFile(filename: string, raw: string) {
	let generated = raw;

	if (filename === 'package.json') {
		const { data: json } = parse.json(generated);

		// remove @types/node from generated package.json as we test on different node versions
		delete json.devDependencies['@types/node'];

		// Normalize workspace package versions to avoid snapshot drift on version bumps
		for (const pkg of ['sv', '@sveltejs/sv-utils']) {
			for (const dependency of ['peerDependencies', 'devDependencies']) {
				if (json[dependency]?.[pkg]) json[dependency][pkg] = '^0.0.0';
			}
		}
		generated = JSON.stringify(json, null, '\t');
	}

	// make it work on Windows too
	generated = generated.replaceAll('\r\n', '\n');

	// ensure trailing newline
	if (!generated.endsWith('\n')) generated += '\n';

	// Normalize sv version in README.md to avoid snapshot drift
	if (filename === 'README.md') {
		generated = generated.replace(SV_VERSION_REGEX, 'sv@0.0.0');
	}

	// Normalize the cloudflare adapter's `compatibility_date` to avoid daily drift
	if (filename === 'wrangler.jsonc') {
		generated = generated.replace(
			/"compatibility_date": "\d{4}-\d{2}-\d{2}"/,
			'"compatibility_date": "2020-01-01"'
		);
	}

	return generated;
}
