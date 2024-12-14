import type { OptionDefinition, OptionValues, Question } from './options.ts';
import type { Workspace } from './workspace.ts';

export type ConditionDefinition<Args extends OptionDefinition> = (
	Workspace: Workspace<Args>
) => boolean;

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

export type SvApi = {
	file: (path: string, edit: (content: string) => string) => void;
	dependency: (pkg: string, version: string) => void;
	devDependency: (pkg: string, version: string) => void;
	execute: (args: string[], stdio: 'inherit' | 'pipe') => Promise<void>;
};

export type Addon<Args extends OptionDefinition> = {
	id: string;
	alias?: string;
	shortDescription?: string;
	homepage?: string;
	options: Args;
	setup?: (
		workspace: Workspace<Args> & {
			dependsOn: (name: string) => void;
			unsupported: (reason: string) => void;
		}
	) => MaybePromise<void>;
	run: (workspace: Workspace<Args> & { sv: SvApi }) => MaybePromise<void>;
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
	env: (str: string) => string; // used for printing environment variable names
};

export function defineAddon<Args extends OptionDefinition>(config: Addon<Args>): Addon<Args> {
	return config;
}

export type AddonSetupResult = { dependsOn: string[]; unsupported: string[] };

export type AddonWithoutExplicitArgs = Addon<Record<string, Question>>;
export type AddonConfigWithoutExplicitArgs = Addon<Record<string, Question>>;

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

export function defineAddonOptions<const Args extends OptionDefinition>(options: Args): Args {
	return options;
}

type MaybePromise<T> = Promise<T> | T;

export type Precondition = {
	name: string;
	run: () => MaybePromise<{ success: boolean; message: string | undefined }>;
};
