import type { OptionDefinition, OptionValues, Question } from './options.ts';
export type { OptionValues } from './options.ts';
import type { Workspace, WorkspaceOptions } from './workspace.ts';
import type { officialAddons } from '../addons/index.ts';

export type ConditionDefinition = (Workspace: Workspace) => boolean;

export type PackageDefinition = {
	name: string;
	version: string;
	dev: boolean;
	condition?: ConditionDefinition;
};

export type Scripts = {
	description: string;
	args: string[];
	stdio: 'inherit' | 'pipe';
	condition?: ConditionDefinition;
};

export type SvApi = {
	/** Add a package to the pnpm build dependencies. */
	pnpmBuildDependency: (pkg: string) => void;
	/** Add a package to the dependencies. */
	dependency: (pkg: string, version: string) => void;
	/** Add a package to the dev dependencies. */
	devDependency: (pkg: string, version: string) => void;
	/** Execute a command in the workspace. */
	execute: (args: string[], stdio: 'inherit' | 'pipe') => Promise<void>;
	/** Edit a file in the workspace. (will create it if it doesn't exist) */
	file: (path: string, edit: (content: string) => string) => void;
};

export type Addon<Args extends OptionDefinition, Id extends string = string> = {
	id: Id;
	alias?: string;
	shortDescription?: string;
	homepage?: string;
	/** If true, this addon won't appear in the interactive prompt but can still be used via CLI */
	hidden?: boolean;
	options: Args;
	/** Setup the addon. Will be called before the addon is run. */
	setup?: (
		workspace: Workspace & {
			/** On what official addons does this addon depend on? */
			dependsOn: (name: keyof typeof officialAddons) => void;

			/** Why is this addon not supported?
			 *
			 * @example
			 * if (!kit) unsupported('Requires SvelteKit');
			 */
			unsupported: (reason: string) => void;

			/** On what official addons does this addon run after? */
			runsAfter: (name: keyof typeof officialAddons) => void;
		}
	) => MaybePromise<void>;
	/** Run the addon. The actual execution of the addon... Add files, edit files, etc. */
	run: (
		workspace: Workspace & {
			/** Add-on options */
			options: WorkspaceOptions<Args>;
			/** Api to interact with the workspace. */
			sv: SvApi;
			/** Cancel the addon at any time!
			 * @example
			 * return cancel('There is a problem with...');
			 */
			cancel: (reason: string) => void;
		}
	) => MaybePromise<void>;
	/** Next steps to display after the addon is run. */
	nextSteps?: (data: Workspace & { options: WorkspaceOptions<Args> }) => string[];
};

/**
 * The entry point for your addon, It will hold every thing! (options, setup, run, nextSteps, ...)
 */
export function defineAddon<const Id extends string, Args extends OptionDefinition>(
	config: Addon<Args, Id>
): Addon<Args, Id> {
	return config;
}

// ============================================================================
// Addon Pipeline Flow
// ============================================================================
//
//   CLI args
//      │
//      ▼
//   AddonInput[]        ──  Stage 1: Raw user input ("eslint", "file:../x")
//      │
//      │  classifyAddons()
//      ▼
//   AddonReference[]    ──  Stage 2: Classified source (official/file/npm)
//      │
//      │  resolveAddons()
//      ▼
//   LoadedAddon[]       ──  Stage 3: Code loaded (addon definition present)
//      │
//      │  setupAddons()
//      ▼
//   PreparedAddon[]     ──  Stage 4: Setup done (dependencies resolved)
//      │
//      │  promptAddonQuestions()
//      ▼
//   ConfiguredAddon[]   ──  Stage 5: User configured (answers collected)
//      │
//      │  applyAddons()
//      ▼
//   AddonResult[]       ──  Stage 6: Execution complete
//
// ============================================================================

/**
 * Stage 1: Raw CLI input - what the user typed
 */
export type AddonInput = {
	readonly specifier: string; // "eslint", "file:../x", "@org/pkg"
	readonly options: string[]; // ["demo:yes"]
};

/**
 * Stage 2: Classified source - knows where addon comes from
 */
export type AddonSource =
	| { readonly kind: 'official'; readonly id: string }
	| { readonly kind: 'file'; readonly path: string }
	| {
			readonly kind: 'npm';
			readonly packageName: string;
			readonly npmUrl: string;
			readonly registryUrl: string;
			readonly tag: string; // e.g. "latest", "1.0.0"
	  };

export type AddonReference = {
	readonly specifier: string;
	readonly options: string[];
	readonly source: AddonSource;
};

/**
 * Stage 3: Code loaded - addon definition is always present
 */
export type LoadedAddon = {
	readonly reference: AddonReference;
	readonly addon: AddonDefinition; // always present, never undefined
};

/**
 * Stage 4: Setup done - has dependency info
 */
export type PreparedAddon = LoadedAddon & {
	readonly setupResult: SetupResult;
};

/**
 * Stage 5: User configured - has answers to questions
 */
export type ConfiguredAddon = PreparedAddon & {
	readonly answers: OptionValues<any>;
};

/**
 * Stage 6: Execution result
 */
export type AddonResult = {
	readonly id: string;
	readonly status: 'success' | { canceled: string[] };
	readonly files: string[];
};

/**
 * Generates an inline error hint based on the addon source
 */
export function getErrorHint(source: AddonSource): string {
	switch (source.kind) {
		case 'official':
			return `Please report this issue: https://github.com/sveltejs/cli/issues`;
		case 'file':
			return `This is a local add-on at '${source.path}', please check your code.`;
		case 'npm':
			return `If this is an issue with the community add-on, please report it: ${source.npmUrl}`;
	}
}

export type SetupResult = { dependsOn: string[]; unsupported: string[]; runsAfter: string[] };

export type AddonDefinition<Id extends string = string> = Addon<Record<string, Question<any>>, Id>;

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
	/**
	 * This type is a bit complex, but in usage, it's quite simple!
	 *
	 * The idea is to `add()` options one by one, with the key and the question.
	 *
	 * ```ts
	 *   .add('demo', {
	 *     question: 'Do you want to add a demo?',
	 *     type: 'boolean',  // string, number, select, multiselect
	 *     default: true,
	 *     // condition: (o) => o.previousOption === 'ok',
	 *   })
	 * ```
	 */
	add<K extends string, const Q extends Question<T & Record<K, Q>>>(
		key: K,
		question: Q
	): OptionBuilder<T & Record<K, Q>>;
	/** Finalize all options of your `add-on`. */
	build(): Prettify<T>;
};

// Initializing with an empty object is intended given that the starting state _is_ empty.
/**
 * Options for an addon.
 *
 * Will be prompted to the user if there are not answered by args when calling the cli.
 *
 * ```ts
 * const options = defineAddonOptions()
 *   .add('demo', {
 *     question: `demo? ${color.optional('(a cool one!)')}`
 *     type: string | boolean | number | select | multiselect,
 *     default: true,
 *   })
 *   .build();
 * ```
 *
 * To define by args, you can do
 * ```sh
 * npx sv add <addon>=<option1>:<value1>+<option2>:<value2>
 * ```
 */
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
