import degit from 'degit';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { execSync } from 'node:child_process';
import pstree, { type PS } from 'ps-tree';
import { exec, x } from 'tinyexec';

import { create } from './create/index.ts';
import type { TestProject } from 'vitest/node';
import type { AddonMap, OptionMap } from './addons/add.ts';
import type { Page } from '@playwright/test';

export { addPnpmBuildDependencies } from './cli/utils/package-manager.ts';
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
export async function setup({
	cwd,
	clean = false,
	variants
}: SetupOptions): Promise<{ templatesDir: string }> {
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
		} else if (variant === 'vite-js' || variant === 'vite-ts') {
			const name = `template-svelte${variant === 'vite-ts' ? '-ts' : ''}`;
			// TODO: should probably point this to a specific commit hash (ex: `#1234abcd`)
			const template = degit(`vitejs/vite/packages/create-vite/${name}`, { force: true });
			await template.clone(templatePath);

			// vite templates have their gitignore file named as `_gitignore`
			const gitignorePath = path.resolve(templatePath, '_gitignore');
			if (fs.existsSync(gitignorePath)) {
				const fixedPath = path.resolve(templatePath, '.gitignore');
				fs.renameSync(gitignorePath, fixedPath);
			}
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
		timeout: 60_000
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
		const { templatesDir } = await setup({ cwd: TEST_DIR, variants });

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
