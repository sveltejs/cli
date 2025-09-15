import fs from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import { exec, execSync } from 'node:child_process';
import * as vitest from 'vitest';
import { installAddon, type AddonMap, type OptionMap } from 'sv';
import {
	createProject,
	startPreview,
	addPnpmBuildDependencies,
	type CreateProject,
	type ProjectVariant
} from 'sv/testing';
import { chromium, type Browser, type BrowserContext, type Page } from '@playwright/test';

const cwd = vitest.inject('testDir');
const templatesDir = vitest.inject('templatesDir');
const variants = vitest.inject('variants');

export const execAsync = promisify(exec);

type Fixtures<Addons extends AddonMap> = {
	page: Page;
	run(variant: ProjectVariant, options: OptionMap<Addons>): Promise<string>;
};

export function setupTest<Addons extends AddonMap>(
	addons: Addons,
	options?: { browser?: boolean }
) {
	const test = vitest.test.extend<Fixtures<Addons>>({} as any);

	const withBrowser = options?.browser ?? true;

	let create: CreateProject;
	let browser: Browser;

	if (withBrowser) {
		vitest.beforeAll(async () => {
			browser = await chromium.launch();
			return async () => {
				await browser.close();
			};
		});
	}

	vitest.beforeAll(({ name }) => {
		const testName = path.dirname(name).split('/').at(-1)!;

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
		let browserCtx: BrowserContext;
		if (withBrowser) {
			browserCtx = await browser.newContext();
			ctx.page = await browserCtx.newPage();
		}
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
			if (withBrowser) {
				await browserCtx.close();
			}
			// ...other tear downs
		};
	});

	return { test, variants, prepareServer };
}

type PrepareServerOptions = {
	cwd: string;
	page: Page;
	previewCommand?: string;
	buildCommand?: string;
	installCommand?: string;
};
// installs dependencies, builds the project, and spins up the preview server
async function prepareServer(
	{
		cwd,
		page,
		previewCommand = 'npm run preview',
		buildCommand = 'npm run build',
		installCommand = 'pnpm install --no-frozen-lockfile'
	}: PrepareServerOptions,
	afterInstall?: () => Promise<any> | any
) {
	// install deps
	if (installCommand) execSync(installCommand, { cwd, stdio: 'pipe' });

	// ...do commands and any other extra stuff
	await afterInstall?.();

	// build project
	if (buildCommand) execSync(buildCommand, { cwd, stdio: 'pipe' });

	// start preview server
	const { url, close } = await startPreview({ cwd, command: previewCommand });

	// increases timeout as 30s is not always enough when running the full suite
	page.setDefaultNavigationTimeout(60_000);

	try {
		// navigate to the page
		await page.goto(url);
	} catch (e) {
		// cleanup in the instance of a timeout
		await close();
		throw e;
	}

	return { url, close };
}
