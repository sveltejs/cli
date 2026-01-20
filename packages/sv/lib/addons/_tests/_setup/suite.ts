import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { inject, test as vitestTest, beforeAll, beforeEach } from 'vitest';
import { chromium } from '@playwright/test';

import { add } from 'sv';
import {
	createProject,
	addPnpmBuildDependencies,
	prepareServer,
	type AddonTestCase,
	type Fixtures,
	type SetupTestOptions
} from 'sv/testing';
import type { AddonMap } from '../../_engine/add.ts';

const cwd = inject('testDir');
const templatesDir = inject('templatesDir');
const variants = inject('variants');

export function setupTest<Addons extends AddonMap>(
	addons: Addons,
	options?: SetupTestOptions<Addons>
) {
	const test = vitestTest.extend<Fixtures>({} as any);

	const withBrowser = options?.browser ?? true;

	let create: ReturnType<typeof createProject>;
	let browser: Awaited<ReturnType<typeof chromium.launch>>;

	if (withBrowser) {
		beforeAll(async () => {
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
	beforeAll(async ({ name }) => {
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

			if (options?.preAdd) {
				await options.preAdd({ addonTestCase, cwd });
			}
			const { pnpmBuildDependencies } = await add({
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
	beforeEach<Fixtures>(async (ctx) => {
		let browserCtx: Awaited<ReturnType<typeof browser.newContext>>;
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
