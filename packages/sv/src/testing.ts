import type { Page } from '@playwright/test';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import pstree, { type PS } from 'ps-tree';
import { exec, x } from 'tinyexec';
import type { TestProject } from 'vitest/node';
import { add, type AddonMap, type OptionMap } from './core/engine.ts';
import { addPnpmOnlyBuiltDependencies } from './core/package-manager.ts';
import { create } from './create/index.ts';

export type ProjectVariant = 'kit-js' | 'kit-ts' | 'vite-js' | 'vite-ts';
export const variants: ProjectVariant[] = ['kit-js', 'kit-ts', 'vite-js', 'vite-ts'];

const TEMPLATES_DIR = '.templates';

export type CreateProject = (options: {
	testId: string;
	variant: ProjectVariant;
	/** @default true */
	clean?: boolean;
}) => string;

type SetupOptions = {
	cwd: string;
	variants: readonly ProjectVariant[];
	/** @default false */
	clean?: boolean;
};
export function setup({ cwd, clean = false, variants }: SetupOptions): { templatesDir: string } {
	const workingDir = path.resolve(cwd);
	if (clean && fs.existsSync(workingDir)) {
		fs.rmSync(workingDir, { force: true, recursive: true });
	}

	// fetch the project types
	const templatesDir = path.resolve(workingDir, TEMPLATES_DIR);
	fs.mkdirSync(templatesDir, { recursive: true });
	for (const variant of variants) {
		const templatePath = path.resolve(templatesDir, variant);
		if (fs.existsSync(templatePath)) continue;

		if (variant === 'kit-js') {
			create(templatePath, { name: variant, template: 'minimal', types: 'checkjs' });
		} else if (variant === 'kit-ts') {
			create(templatePath, { name: variant, template: 'minimal', types: 'typescript' });
		} else if (variant === 'vite-js') {
			create(templatePath, { name: variant, template: 'svelte', types: 'none' });
		} else if (variant === 'vite-ts') {
			create(templatePath, { name: variant, template: 'svelte', types: 'typescript' });
		} else {
			throw new Error(`Unknown project variant: ${variant}`);
		}
	}

	return { templatesDir };
}

type CreateOptions = { cwd: string; testName: string; templatesDir: string };
export function createProject({ cwd, testName, templatesDir }: CreateOptions): CreateProject {
	// create the reference dir
	const testDir = path.resolve(cwd, testName);
	fs.mkdirSync(testDir, { recursive: true });
	return ({ testId, variant, clean = true }) => {
		const targetDir = path.resolve(testDir, testId);
		if (clean && fs.existsSync(targetDir)) {
			fs.rmSync(targetDir, { force: true, recursive: true });
		}
		const templatePath = path.resolve(templatesDir, variant);
		fs.cpSync(templatePath, targetDir, { recursive: true, force: true });
		return targetDir;
	};
}

type PreviewOptions = { cwd: string; command?: string };
export async function startPreview({
	cwd,
	command = 'npm run preview'
}: PreviewOptions): Promise<{ url: string; close: () => Promise<void> }> {
	const [cmd, ...args] = command.split(' ');
	const proc = exec(cmd, args, {
		nodeOptions: { cwd, stdio: 'pipe' },
		throwOnError: true,
		timeout: 66_999
	});

	const close = async () => {
		if (!proc.pid) return;
		await terminate(proc.pid);
	};

	return await new Promise((resolve, reject) => {
		if (!proc.process?.stdout) return reject('impossible state');

		proc.process.stdout.on('data', (data: Buffer) => {
			const value = data.toString();

			// extract dev server url from console output
			const regexUnicode = /[^\x20-\xaf]+/g;
			const withoutUnicode = value.replace(regexUnicode, '');

			const regexUnicodeDigits = /\[[0-9]{1,2}m/g;
			const withoutColors = withoutUnicode.replace(regexUnicodeDigits, '');

			const regexUrl = /http:\/\/[^:\s]+:[0-9]+\//g;
			const urls = withoutColors.match(regexUrl);

			if (urls && urls.length > 0) {
				const url = urls[0];
				resolve({ url, close });
			}
		});
	});
}

async function getProcessTree(pid: number) {
	return new Promise<readonly PS[]>((res, rej) => {
		pstree(pid, (err, children) => {
			if (err) rej(err);
			res(children);
		});
	});
}

async function terminate(pid: number) {
	if (process.platform === 'win32') {
		// on windows, use taskkill to terminate the process tree
		await x('taskkill', ['/PID', `${pid}`, '/T', '/F']);
		return;
	}
	const children = await getProcessTree(pid);
	// the process tree is ordered from parents -> children,
	// so we'll iterate in the reverse order to terminate the children first
	for (let i = children.length - 1; i >= 0; i--) {
		const child = children[i];
		const pid = Number(child.PID);
		kill(pid);
	}
	kill(pid);
}

function kill(pid: number) {
	try {
		process.kill(pid);
	} catch {
		// this can happen if a process has been automatically terminated.
	}
}

declare module 'vitest' {
	export interface ProvidedContext {
		testDir: string;
		templatesDir: string;
		variants: ProjectVariant[];
	}
}

export function setupGlobal({
	TEST_DIR,
	pre,
	post
}: {
	TEST_DIR: string;
	pre?: () => Promise<void>;
	post?: () => Promise<void>;
}): ({ provide }: TestProject) => Promise<() => Promise<void>> {
	return async function ({ provide }: TestProject) {
		await pre?.();

		// downloads different project configurations (sveltekit, js/ts, vite-only, etc)
		const { templatesDir } = setup({ cwd: TEST_DIR, variants });

		provide('testDir', TEST_DIR);
		provide('templatesDir', templatesDir);
		provide('variants', variants);

		return async () => {
			await post?.();
		};
	};
}

export type Fixtures = {
	page: Page;
	cwd(addonTestCase: AddonTestCase<any>): string;
};

export type AddonTestCase<Addons extends AddonMap> = {
	variant: ProjectVariant;
	kind: { type: string; options: OptionMap<Addons> };
};

export type SetupTestOptions<Addons extends AddonMap> = {
	kinds: Array<AddonTestCase<Addons>['kind']>;
	filter?: (addonTestCase: AddonTestCase<Addons>) => boolean;
	browser?: boolean;
	preAdd?: (o: { addonTestCase: AddonTestCase<Addons>; cwd: string }) => Promise<void> | void;
};

export type PrepareServerOptions = {
	cwd: string;
	page: Page;
	buildCommand?: string;
	previewCommand?: string;
};

export type PrepareServerReturn = {
	url: string;
	close: () => Promise<void>;
};

// installs dependencies, builds the project, and spins up the preview server
export async function prepareServer({
	cwd,
	page,
	buildCommand = 'pnpm build',
	previewCommand = 'pnpm preview'
}: PrepareServerOptions): Promise<PrepareServerReturn> {
	// build project
	if (buildCommand) execSync(buildCommand, { cwd, stdio: 'pipe' });

	// start preview server
	const { url, close } = await startPreview({ cwd, command: previewCommand });

	// increases timeout as 30s is not always enough when running the full suite
	page.setDefaultNavigationTimeout(62_000);

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

export type VitestContext = Pick<
	typeof import('vitest'),
	'inject' | 'test' | 'beforeAll' | 'beforeEach'
>;

export function createSetupTest(vitest: VitestContext): <Addons extends AddonMap>(
	addons: Addons,
	options?: SetupTestOptions<Addons>
) => {
	test: import('vitest').TestAPI<Fixtures>;
	testCases: Array<AddonTestCase<AddonMap>>;
	prepareServer: typeof prepareServer;
} {
	return function setupTest<Addons extends AddonMap>(
		addons: Addons,
		options?: SetupTestOptions<Addons>
	) {
		const { inject, test: vitestTest, beforeAll, beforeEach } = vitest;

		const test = vitestTest.extend({}) as unknown as import('vitest').TestAPI<Fixtures>;

		const cwd = inject('testDir');
		const templatesDir = inject('templatesDir');
		const variants = inject('variants');

		const withBrowser = options?.browser ?? true;

		let create: ReturnType<typeof createProject>;
		let browser: Awaited<ReturnType<typeof import('@playwright/test').chromium.launch>>;

		if (withBrowser) {
			beforeAll(async () => {
				let chromium: Awaited<typeof import('@playwright/test')>['chromium'];
				try {
					({ chromium } = await import('@playwright/test'));
				} catch {
					throw new Error(
						'Browser testing requires @playwright/test. Install it with: pnpm add -D @playwright/test'
					);
				}
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
		test.beforeAll(async (_ctx, suite) => {
			testName = path.dirname(suite.file.filepath).split('/').at(-1)!;

			create = createProject({ cwd, templatesDir, testName });

			fs.writeFileSync(
				path.resolve(cwd, testName, 'pnpm-workspace.yaml'),
				"packages:\n  - '**/*'",
				'utf8'
			);

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

				const metaPath = path.resolve(cwd, 'meta.json');
				fs.writeFileSync(metaPath, JSON.stringify({ variant, kind }, null, '\t'), 'utf8');

				if (options?.preAdd) {
					await options.preAdd({ addonTestCase, cwd });
				}
				await add({
					cwd,
					addons,
					options: kind.options,
					packageManager: 'pnpm'
				});
				addPnpmOnlyBuiltDependencies(cwd, 'pnpm', 'esbuild');
			}

			execSync('pnpm install', { cwd: path.resolve(cwd, testName), stdio: 'pipe' });
		});

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
			};
		});

		return { test, testCases, prepareServer };
	};
}
