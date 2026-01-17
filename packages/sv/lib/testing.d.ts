import type { TestProject } from 'vitest/node';
import type { AddonMap, OptionMap } from './addons/add.js';
import type { Page } from '@playwright/test';

export { addPnpmBuildDependencies } from './cli/utils/package-manager.js';

export type ProjectVariant = 'kit-js' | 'kit-ts' | 'vite-js' | 'vite-ts';
export const variants: ProjectVariant[];

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
export function setup(options: SetupOptions): Promise<{ templatesDir: string }>;

type CreateOptions = { cwd: string; testName: string; templatesDir: string };
export function createProject(options: CreateOptions): CreateProject;

type PreviewOptions = { cwd: string; command?: string };
export function startPreview(
	options: PreviewOptions
): Promise<{ url: string; close: () => Promise<void> }>;

declare module 'vitest' {
	export interface ProvidedContext {
		testDir: string;
		templatesDir: string;
		variants: ProjectVariant[];
	}
}

export function setupGlobal(options: {
	TEST_DIR: string;
	pre?: () => Promise<void>;
	post?: () => Promise<void>;
}): (context: TestProject) => Promise<() => Promise<void>>;

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

export function prepareServer(options: PrepareServerOptions): Promise<PrepareServerReturn>;
