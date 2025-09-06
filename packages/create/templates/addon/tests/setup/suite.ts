import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import * as vitest from 'vitest';
import { installAddon, type AddonMap, type OptionMap } from 'sv';
import {
	addPnpmBuildDependencies,
	createProject,
	startPreview,
	type CreateProject,
	type ProjectVariant
} from 'sv/testing';
import { chromium, type Browser, type Page } from '@playwright/test';
import { fileURLToPath } from 'node:url';

const cwd = vitest.inject('testDir');
const templatesDir = vitest.inject('templatesDir');
const variants = vitest.inject('variants');

const SETUP_DIR = fileURLToPath(new URL('.', import.meta.url));

type Fixtures<Addons extends AddonMap> = {
	page: Page;
	run(variant: ProjectVariant, options: OptionMap<Addons>): Promise<string>;
};

export function setupTest<Addons extends AddonMap>(addons: Addons) {
	let create: CreateProject;
	let browser: Browser;

	const test = vitest.test.extend<Fixtures<Addons>>({} as any);

	vitest.beforeAll(async () => {
		browser = await chromium.launch();
		return async () => {
			await browser.close();
		};
	});

	vitest.beforeAll(({ name }) => {
		const testName = path.parse(name).name.replace('.test', '');

		// constructs a builder for create test projects
		create = createProject({ cwd, templatesDir, testName });

		// creates a pnpm workspace in each addon dir
		fs.writeFileSync(
			path.resolve(cwd, testName, 'pnpm-workspace.yaml'),
			"packages:\n  - '**/*'",
			'utf8'
		);

		// creates a barebones package.json in each addon dir
		fs.writeFileSync(
			path.resolve(cwd, testName, 'package.json'),
			JSON.stringify({
				name: `${testName}-workspace-root`,
				private: true
			})
		);
	});

	// runs before each test case
	vitest.beforeEach<Fixtures<Addons>>(async (ctx) => {
		const browserCtx = await browser.newContext();
		ctx.page = await browserCtx.newPage();
		ctx.run = async (variant, options) => {
			const cwd = create({ testId: ctx.task.id, variant });

			// test metadata
			const metaPath = path.resolve(cwd, 'meta.json');
			fs.writeFileSync(metaPath, JSON.stringify({ variant, options }, null, '\t'), 'utf8');

			// run addon
			const { pnpmBuildDependencies } = await installAddon({
				cwd,
				addons,
				options,
				packageManager: 'pnpm'
			});
			addPnpmBuildDependencies(cwd, 'pnpm', ['esbuild', ...pnpmBuildDependencies]);

			return cwd;
		};

		return async () => {
			await browserCtx.close();
			// ...other tear downs
		};
	});

	return {
		test,
		variants,
		prepareServer
	};
}

/**
 * Installs dependencies, builds the project, and spins up the preview server
 */
async function prepareServer({ cwd, page }: { cwd: string; page: Page }) {
	// install deps
	execSync('pnpm install --no-frozen-lockfile', { cwd, stdio: 'pipe' });

	// ...do commands and any other extra stuff

	// build project
	execSync('npm run build', { cwd, stdio: 'pipe' });

	// start preview server `vite preview`
	const { url, close } = await startPreview({ cwd });

	// navigate to the page
	await page.goto(url);

	return { url, close };
}

/**
 * Applies a fixture to the target path
 */
export function fixture({ name, target }: { name: string; target: string }) {
	const fixturePath = path.resolve(SETUP_DIR, '..', 'fixtures', name);
	if (!fs.existsSync(fixturePath)) {
		throw new Error(`Fixture does not exist at: ${fixturePath}`);
	}
	fs.copyFileSync(fixturePath, target);
}
