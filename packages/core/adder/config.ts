import type { OptionDefinition, OptionValues, Question } from './options.ts';
import type { FileType } from '../files/processors.ts';
import type { Workspace } from '../files/workspace.ts';

export type ConditionDefinition<Args extends OptionDefinition> = (
	Workspace: Workspace<Args>
) => boolean;

export type WebsiteMetadata = {
	logo: string;
	keywords: string[];
	documentation: string;
};

export type AdderConfigEnvironments = {
	svelte: boolean;
	kit: boolean;
};

export type AdderConfigMetadata = {
	id: string;
	alias?: string;
	name: string;
	description: string;
	environments: AdderConfigEnvironments;
	website?: WebsiteMetadata;
};

export type PackageDefinition<Args extends OptionDefinition> = {
	name: string;
	version: string;
	dev: boolean;
	condition?: ConditionDefinition<Args>;
};

export type Scripts<Args extends OptionDefinition> = {
	description: string;
	args: string[];
	stdio: 'inherit' | 'pipe';
	condition?: ConditionDefinition<Args>;
};

export type AdderConfig<Args extends OptionDefinition> = {
	metadata: AdderConfigMetadata;
	options: Args;
	runsAfter?: string[];
	dependsOn?: string[];
	packages: Array<PackageDefinition<Args>>;
	scripts?: Array<Scripts<Args>>;
	files: Array<FileType<Args>>;
	preconditions?: Precondition[];
	nextSteps?: (
		data: {
			highlighter: Highlighter;
		} & Workspace<Args>
	) => string[];
};

export type Highlighter = {
	path: (str: string) => string;
	command: (str: string) => string;
	website: (str: string) => string;
	route: (str: string) => string;
	env: (str: string) => string;
};

export function defineAdderConfig<Args extends OptionDefinition>(
	config: AdderConfig<Args>
): AdderConfig<Args> {
	return config;
}

export type Adder<Args extends OptionDefinition> = {
	config: AdderConfig<Args>;
	tests?: AdderTestConfig<Args>;
};

export type AdderWithoutExplicitArgs = Adder<Record<string, Question>>;
export type AdderConfigWithoutExplicitArgs = AdderConfig<Record<string, Question>>;

export function defineAdder<Args extends OptionDefinition>(
	config: AdderConfig<Args>,
	tests?: AdderTestConfig<Args>
): Adder<Args> {
	const adder: Adder<Args> = { config, tests };
	return adder;
}

export type Tests = {
	expectProperty: (selector: string, property: string, expectedValue: string) => Promise<void>;
	elementExists: (selector: string) => Promise<void>;
	click: (selector: string, path?: string) => Promise<void>;
	expectUrlPath: (path: string) => void;
};

export type TestDefinition<Args extends OptionDefinition> = {
	name: string;
	run: (tests: Tests) => Promise<void>;
	condition?: (options: OptionValues<Args>) => boolean;
};

export type AdderTestConfig<Args extends OptionDefinition> = {
	files: Array<FileType<Args>>;
	options: Args;
	optionValues: Array<OptionValues<Args>>;
	runSynchronously?: boolean;
	command?: string;
	tests: Array<TestDefinition<Args>>;
};

export function defineAdderTests<Args extends OptionDefinition>(
	tests: AdderTestConfig<Args>
): AdderTestConfig<Args> {
	return tests;
}

export function defineAdderOptions<const Args extends OptionDefinition>(options: Args): Args {
	return options;
}

type MaybePromise<T> = Promise<T> | T;

export type Precondition = {
	name: string;
	run: () => MaybePromise<{ success: boolean; message: string | undefined }>;
};
