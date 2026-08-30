import fs from 'node:fs';
import path from 'node:path';
import * as find from 'empathic/find';
import { exec, type Result } from 'tinyexec';
import { beforeAll, describe, expect, test } from 'vitest';
import { createProject } from '../../cli/create.ts';
import { type LanguageType, type TemplateType } from '../index.ts';

const ROOT = path.dirname(find.up('pnpm-workspace.yaml', { cwd: import.meta.dirname })!);
const TEMPLATES_DIR = path.resolve(ROOT, 'packages', 'sv', 'src', 'create', 'templates');
const TEST_DIR = path.resolve(ROOT, 'packages', 'sv', '.test-output', 'create');

// prepare test pnpm workspace
fs.rmSync(TEST_DIR, { recursive: true, force: true });
fs.mkdirSync(TEST_DIR, { recursive: true });

fs.writeFileSync(path.join(TEST_DIR, 'pnpm-workspace.yaml'), 'packages:\n  - ./*\n');

beforeAll(async () => {
	const install = await exec('pnpm', ['install', '--no-frozen-lockfile'], {
		nodeOptions: { cwd: TEST_DIR }
	});
	if (install.exitCode !== 0) {
		throw new Error(
			`pnpm install failed in ${TEST_DIR}\n  stdout: ${install.stdout}\n  stderr: ${install.stderr}`
		);
	}
}, 60000);

/**
 * Tests in different templates can be run concurrently for a nice speedup locally, but tests within a template must be run sequentially.
 * It'd be better to group tests by template, but vitest doesn't support that yet.
 */
const script_test_map = new Map<string, Array<[string, () => Result]>>();

const templates = fs.readdirSync(TEMPLATES_DIR) as TemplateType[];

for (const template of templates.filter((t) => t !== 'addon')) {
	if (template[0] === '.') continue;

	for (const types of ['checkjs', 'typescript', 'none'] as LanguageType[]) {
		const cwd = path.join(TEST_DIR, `${template}-${types}`);
		fs.rmSync(cwd, { recursive: true, force: true });

		if (template === 'demo' && types === 'typescript') {
			const ignoredArtifact = path.join(cwd, 'static', 'ignored.json');
			fs.mkdirSync(path.dirname(ignoredArtifact), { recursive: true });
			fs.writeFileSync(ignoredArtifact, '{"ignored":true}');

			await createProject(cwd, {
				types,
				addOns: true,
				add: ['prettier', 'eslint'],
				install: 'pnpm',
				template,
				fromPlayground: undefined,
				dirCheck: false,
				downloadCheck: false
			});

			describe('prettier ignore', () => {
				test(`${template}-${types}`, () => {
					expect(fs.readFileSync(ignoredArtifact, 'utf-8')).toBe('{"ignored":true}');
				});
			});
		} else {
			await createProject(cwd, {
				types,
				addOns: true,
				add: ['eslint'],
				install: false,
				template,
				fromPlayground: undefined,
				dirCheck: false,
				downloadCheck: false
			});
		}

		const pkg = JSON.parse(fs.readFileSync(path.join(cwd, 'package.json'), 'utf-8'));

		// run provided scripts that are non-blocking. All of them should exit with 0
		// package script requires lib dir
		const scripts_to_test = ['lint', 'format', 'check', 'build', 'package'].filter(
			(s) => s in pkg.scripts
		);

		for (const script of scripts_to_test) {
			const tests = script_test_map.get(script) ?? [];
			tests.push([
				`${template}-${types}`,
				() => exec('pnpm', [script], { nodeOptions: { cwd }, throwOnError: true })
			]);
			script_test_map.set(script, tests);
		}

		if (template === 'demo') {
			describe(`local import with extensions`, () => {
				test(`${template}-${types}`, () => {
					const ending = types === 'typescript' ? 'ts' : 'js';
					const gameFile = path.join(cwd, `src/routes/sverdle/game.${ending}`);
					const gameFileContent = fs.readFileSync(gameFile, 'utf-8');
					expect(gameFileContent).toContain(`./words.server.${ending}`);
				});
			});
		}
	}
}

describe.concurrent('create scripts', { timeout: 61_000 }, () => {
	for (const [script, tests] of script_test_map) {
		for (const [name, task] of tests) {
			test(`${script} - ${name}`, task);
		}
	}
});
