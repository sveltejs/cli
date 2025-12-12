import { type Browser, type BrowserContext, type Page, chromium } from '@playwright/test';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { type AddonMap, installAddon } from 'sv';
import {
	type CreateProject,
	addPnpmBuildDependencies,
	createProject,
	startPreview,
	type AddonTestCase,
	type Fixtures
} from 'sv/testing';
import * as vitest from 'vitest';

const cwd = vitest.inject('testDir');
const templatesDir = vitest.inject('templatesDir');
const variants = vitest.inject('variants');

export function setupTest<Addons extends AddonMap>(
	addons: Addons,
	options?: {
		kinds: Array<AddonTestCase<Addons>['kind']>;
		filter?: (addonTestCase: AddonTestCase<Addons>) => boolean;
		browser?: boolean;
		preInstallAddon?: (o: {
			addonTestCase: AddonTestCase<Addons>;
			cwd: string;
		}) => Promise<void> | void;
	}
) {
	const test = vitest.test.extend<Fixtures>({} as any);

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

	const testCases: Array<AddonTestCase<Addons>> = [];
	for (const kind of options?.kinds ?? []) {
		for (const variant of variants) {
			const addonTestCase = { variant, kind };
			if (options?.filter === undefined || options.filter(addonTestCase)) {
				testCases.push(addonTestCase);
			}
		}
	}
	let testName: string;
	vitest.beforeAll(async ({ name }) => {
		testName = path.dirname(name).split('/').at(-1)!;

		// constructs a builder to create test projects
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

		for (const addonTestCase of testCases) {
			const { variant, kind } = addonTestCase;
			const cwd = create({ testId: `${kind.type}-${variant}`, variant });

			// test metadata
			const metaPath = path.resolve(cwd, 'meta.json');
			fs.writeFileSync(metaPath, JSON.stringify({ variant, kind }, null, '\t'), 'utf8');

			if (options?.preInstallAddon) {
				await options.preInstallAddon({ addonTestCase, cwd });
			}
			const { pnpmBuildDependencies } = await installAddon({
				cwd,
				addons,
				options: kind.options,
				packageManager: 'pnpm'
			});
			await addPnpmBuildDependencies(cwd, 'pnpm', ['esbuild', ...pnpmBuildDependencies]);
		}

		execSync('pnpm install', { cwd: path.resolve(cwd, testName), stdio: 'pipe' });
	});

	// runs before each test case
	vitest.beforeEach<Fixtures>(async (ctx) => {
		let browserCtx: BrowserContext;
		if (withBrowser) {
			browserCtx = await browser.newContext();
			ctx.page = await browserCtx.newPage();
		}

		ctx.cwd = (addonTestCase) => {
			return path.join(cwd, testName, `${addonTestCase.kind.type}-${addonTestCase.variant}`);
		};

		return async () => {
			if (withBrowser) {
				await browserCtx.close();
			}
			// ...other tear downs
		};
	});

	return { test, testCases, prepareServer };
}

type PrepareServerOptions = {
	cwd: string;
	page: Page;
	buildCommand?: string;
	previewCommand?: string;
};
// installs dependencies, builds the project, and spins up the preview server
async function prepareServer({
	cwd,
	page,
	buildCommand = 'pnpm build',
	previewCommand = 'pnpm preview'
}: PrepareServerOptions) {
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
