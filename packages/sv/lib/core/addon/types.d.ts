/**
 * Complex type definitions that cannot be expressed in JSDoc.
 * These types use conditional types with `infer`, recursive generics, and mapped types.
 */

import type { officialAddons } from '../../addons/_config/official.js';

// ============ Option Types ============

export type BooleanQuestion = {
	type: 'boolean';
	default: boolean;
};

export type StringQuestion = {
	type: 'string';
	default: string;
	validate?: (value: string | undefined) => string | Error | undefined;
	placeholder?: string;
};

export type NumberQuestion = {
	type: 'number';
	default: number;
	validate?: (value: string | undefined) => string | Error | undefined;
	placeholder?: string;
};

export type SelectQuestion<Value> = {
	type: 'select';
	default: NoInfer<Value>;
	options: Array<{ value: Value; label?: string; hint?: string }>;
};

export type MultiSelectQuestion<Value> = {
	type: 'multiselect';
	default: NoInfer<Value[]>;
	options: Array<{ value: Value; label?: string; hint?: string }>;
	required: boolean;
};

export type BaseQuestion<Args extends OptionDefinition> = {
	question: string;
	group?: string;
	/**
	 * When this condition explicitly returns `false`, the question's value will
	 * always be `undefined` and will not fallback to the specified `default` value.
	 */
	condition?: (options: OptionValues<Args>) => boolean;
};

export type Question<Args extends OptionDefinition = OptionDefinition> = BaseQuestion<Args> &
	(
		| BooleanQuestion
		| StringQuestion
		| NumberQuestion
		| SelectQuestion<any>
		| MultiSelectQuestion<any>
	);

export type OptionDefinition = Record<string, Question<any>>;

/**
 * Extracts the value types from option definitions.
 * Uses conditional types with `infer` - cannot be expressed in JSDoc.
 */
export type OptionValues<Args extends OptionDefinition> = {
	[K in keyof Args]: Args[K] extends StringQuestion
		? string
		: Args[K] extends BooleanQuestion
			? boolean
			: Args[K] extends NumberQuestion
				? number
				: Args[K] extends SelectQuestion<infer Value>
					? Value
					: Args[K] extends MultiSelectQuestion<infer Value>
						? Value[]
						: 'ERROR: The value for this type is invalid. Ensure that the `default` value exists in `options`.';
};

/**
 * Utility type to flatten/prettify complex type intersections.
 * Cannot be expressed in JSDoc.
 */
export type Prettify<T> = {
	[K in keyof T]: T[K];
} & unknown;

/**
 * Builder pattern for addon options.
 * Uses recursive generic constraints - cannot be expressed in JSDoc.
 */
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

export type MaybePromise<T> = Promise<T> | T;

// ============ Workspace Types ============

export type WorkspaceOptions<Args extends OptionDefinition> = OptionValues<Args>;

export type PackageManager = 'npm' | 'yarn' | 'pnpm' | 'bun' | 'deno';

export type Workspace = {
	cwd: string;
	/**
	 * Returns the dependency version declared in the package.json.
	 * This may differ from the installed version.
	 * Includes both dependencies and devDependencies.
	 * Also checks parent package.json files if called in a monorepo.
	 * @param pkg the package to check for
	 * @returns the dependency version with any leading characters such as ^ or ~ removed
	 */
	dependencyVersion: (pkg: string) => string | undefined;
	/** to know if the workspace is using typescript or javascript */
	language: 'ts' | 'js';
	files: {
		viteConfig: 'vite.config.js' | 'vite.config.ts';
		svelteConfig: 'svelte.config.js' | 'svelte.config.ts';
		/** `${kit.routesDirectory}/layout.css` or `src/app.css` */
		stylesheet: `${string}/layout.css` | 'src/app.css';
		package: 'package.json';
		gitignore: '.gitignore';

		prettierignore: '.prettierignore';
		prettierrc: '.prettierrc';
		eslintConfig: 'eslint.config.js';

		vscodeSettings: '.vscode/settings.json';

		/** Get the relative path between two files */
		getRelative: ({ from, to }: { from?: string; to: string }) => string;
	};
	/** If we are in a kit project, this object will contain the lib and routes directories */
	kit: { libDirectory: string; routesDirectory: string } | undefined;
	/** The package manager used to install dependencies */
	packageManager: PackageManager;
};

// ============ Processor Types ============

export type FileEditor = Workspace & { content: string };

export type FileType = {
	name: (options: Workspace) => string;
	condition?: ConditionDefinition;
	content: (editor: FileEditor) => string;
};

// ============ Config Types ============

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

export type Addon<Args extends OptionDefinition> = {
	id: string;
	alias?: string;
	shortDescription?: string;
	homepage?: string;
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

export type AddonSetupResult = { dependsOn: string[]; unsupported: string[]; runsAfter: string[] };

export type ResolvedAddon = Addon<Record<string, Question<any>>> & {
	/** Original specifier used to reference this addon (e.g., "file:../path" or "@scope/name") */
	originalSpecifier?: string;
};

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

export type Verification = {
	name: string;
	run: () => MaybePromise<{ success: boolean; message: string | undefined }>;
};
