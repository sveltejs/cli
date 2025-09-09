import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
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

type Fixtures<Addons extends AddonMap> = {
	page: Page;
	run(variant: ProjectVariant, options: OptionMap<Addons>): Promise<string>;
	cwdVariant: (flavor: string, variant: ProjectVariant) => string;
};

const installAddonHelper = async <Addons extends AddonMap>(
	cwdToUse: string,
	addons: Addons,
	variant: ProjectVariant,
	options: OptionMap<Addons>
) => {
	const metaPath = path.resolve(cwdToUse, 'meta.json');
	fs.writeFileSync(metaPath, JSON.stringify({ variant, options }, null, '\t'), 'utf8');

	// run addon
	const { pnpmBuildDependencies } = await installAddon({
		cwd: cwdToUse,
		addons,
		options,
		packageManager: 'pnpm'
	});

	addPnpmBuildDependencies(cwdToUse, 'pnpm', ['esbuild', ...pnpmBuildDependencies]);
};

export function setupTest<Addons extends AddonMap>(
	addons: Addons,
	options?: {
		skipBrowser?: boolean;
		runPrepareAndInstallWithOption?: Record<
			string,
			{
				options: OptionMap<Addons>;
				include?: (variant: ProjectVariant) => boolean;
			}
		>;
	}
) {
	const test = vitest.test.extend<Fixtures<Addons>>({} as any);

	const withBrowser = !options?.skipBrowser;

	let create: CreateProject;
	let browser: Browser;
	let cwdTestName: string;

	if (withBrowser) {
		vitest.beforeAll(async () => {
			browser = await chromium.launch();
			return async () => {
				await browser.close();
			};
		});
	}

	vitest.beforeAll(async ({ name }) => {
		const testName = path.dirname(name).split('/').at(-1)!;
		cwdTestName = path.resolve(cwd, testName);

		fs.rmSync(cwdTestName, { force: true, recursive: true });

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

		// run prepare and install steps if requested
		if (options?.runPrepareAndInstallWithOption) {
			// prepare: run addon for all variants
			for (const variant of variants) {
				for (const [key, value] of Object.entries(options.runPrepareAndInstallWithOption)) {
					if (value.include && !value.include(variant)) continue;
					const cwd = create({ testId: key + '_' + variant, variant });
					await installAddonHelper(cwd, addons, variant, value.options);
				}
			}

			// install: run pnpm install
			execSync('pnpm install --no-frozen-lockfile', { cwd: cwdTestName, stdio: 'pipe' });
		}
	});

	// runs before each test case
	vitest.beforeEach<Fixtures<Addons>>(async (ctx) => {
		let browserCtx: BrowserContext;
		if (withBrowser) {
			browserCtx = await browser.newContext();
			ctx.page = await browserCtx.newPage();
		}
		ctx.cwdVariant = (flavor, variant) => {
			return path.resolve(cwdTestName, `${flavor}_${variant}`);
		};
		ctx.run = async (variant, runOptions) => {
			const cwd = create({ testId: ctx.task.id, variant });
			await installAddonHelper(cwd, addons, variant, runOptions);
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
	page: Page | null;
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

	if (!page) {
		return { url: '', close: () => Promise.resolve() };
	}

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
