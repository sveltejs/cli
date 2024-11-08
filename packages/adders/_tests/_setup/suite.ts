import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import * as vi from 'vitest';
import { installAddon, type AddonMap, type OptionMap } from 'sv';
import { createProject, startPreview, type CreateProject, type ProjectVariant } from 'sv/test';
import { chromium, type Browser, type Page } from '@playwright/test';

const cwd = vi.inject('testDir');
const templatesDir = vi.inject('templatesDir');
const variants = vi.inject('variants');

type Fixtures<Addons extends AddonMap> = {
	page: Page;
	run(variant: ProjectVariant, options: OptionMap<Addons>): Promise<string>;
};

export function setupTest<Addons extends AddonMap>(addons: Addons) {
	const test = vi.test.extend<Fixtures<Addons>>({} as any);

	let create: CreateProject;
	let browser: Browser;

	vi.beforeAll(async () => {
		browser = await chromium.launch();
		return async () => {
			await browser.close();
		};
	});

	vi.beforeAll(({ name }) => {
		const testName = path.dirname(name).split(path.sep).at(-1)!;

		// constructs a builder for create test projects
		create = createProject({ cwd, templatesDir, testName });

		// creates a pnpm workspace in each addon dir
		fs.writeFileSync(
			path.resolve(cwd, testName, 'pnpm-workspace.yaml'),
			"packages:\n  - '**/*'",
			'utf8'
		);
	});

	// runs before each test case
	vi.beforeEach<Fixtures<Addons>>(async (ctx) => {
		const browserCtx = await browser.newContext();
		ctx.page = await browserCtx.newPage();
		ctx.run = async (variant, options) => {
			const cwd = create({ testId: ctx.task.id, variant });

			// test metadata
			const metaPath = path.resolve(cwd, 'meta.json');
			fs.writeFileSync(metaPath, JSON.stringify({ variant, options }, null, '\t'), 'utf8');

			// run adder
			await installAddon({ cwd, addons, options, packageManager: 'pnpm' });

			return cwd;
		};

		return async () => {
			await browserCtx.close();
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
	execSync(installCommand, { cwd, stdio: 'pipe' });

	// ...do commands and any other extra stuff
	await afterInstall?.();

	// build project
	execSync(buildCommand, { cwd, stdio: 'pipe' });

	// start preview server
	const { url, close } = await startPreview({ cwd, command: previewCommand });

	// navigate to the page
	await page.goto(url);

	return { url, close };
}
