import type { OptionDefinition, OptionValues, Question } from './options.ts';
import type { Workspace, WorkspaceOptions } from './workspace.ts';

export type ConditionDefinition<Args extends OptionDefinition> = (
	Workspace: Workspace
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
	pnpmBuildDependency: (pkg: string) => void;
	dependency: (pkg: string, version: string) => void;
	devDependency: (pkg: string, version: string) => void;
	execute: (args: string[], stdio: 'inherit' | 'pipe') => Promise<void>;
	file: (path: string, edit: (content: string) => string) => void;
};

export type Addon<Args extends OptionDefinition> = {
	id: string;
	alias?: string;
	shortDescription?: string;
	homepage?: string;
	options: Args;
	setup?: (
		workspace: Workspace & {
			dependsOn: (name: string) => void;
			unsupported: (reason: string) => void;
			runsAfter: (addonName: string) => void;
		}
	) => MaybePromise<void>;
	run: (
		workspace: Workspace & { options: WorkspaceOptions<Args>; sv: SvApi; cancel: (reason: string) => void }
	) => MaybePromise<void>;
	nextSteps?: (
		data: {
			highlighter: Highlighter;
		} & Workspace & { options: WorkspaceOptions<Args> }
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

export type AddonSetupResult = { dependsOn: string[]; unsupported: string[]; runsAfter: string[] };

export type AddonWithoutExplicitArgs = Addon<Record<string, Question<any>>>;

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

type MaybePromise<T> = Promise<T> | T;

export type Verification = {
	name: string;
	run: () => MaybePromise<{ success: boolean; message: string | undefined }>;
};

type Prettify<T> = {
	[K in keyof T]: T[K];
} & unknown;

// Builder pattern for addon options
export type OptionBuilder<T extends OptionDefinition> = {
	add<K extends string, const Q extends Question<T & Record<K, Q>>>(
		key: K,
		question: Q
	): OptionBuilder<T & Record<K, Q>>;
	build(): Prettify<T>;
};

// Initializing with an empty object is intended given that the starting state _is_ empty.
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export function defineAddonOptions(): OptionBuilder<{}> {
	return createOptionBuilder({});
}

function createOptionBuilder<const T extends OptionDefinition>(options: T): OptionBuilder<T> {
	return {
		add(key, question) {
			const newOptions = { ...options, [key]: question };
			return createOptionBuilder(newOptions);
		},
		build() {
			return options;
		}
	};
}
