import { svDeprecated } from './core/deprecated.ts';
import { create as _create, type Options as CreateOptions } from './create/index.ts';

export type { TemplateType, LanguageType } from './create/index.ts';

/** @deprecated use `create({ cwd, ...options })` instead */
export function create(cwd: string, options: Omit<CreateOptions, 'cwd'>): void;
export function create(options: CreateOptions): void;
export function create(
	cwdOrOptions: string | CreateOptions,
	legacyOptions?: Omit<CreateOptions, 'cwd'>
): void {
	if (typeof cwdOrOptions === 'string') {
		svDeprecated('use `create({ cwd, ...options })` instead of `create(cwd, options)`');
		_create({ cwd: cwdOrOptions, ...legacyOptions! });
	} else {
		_create(cwdOrOptions);
	}
}

export { add } from './core/engine.ts';
export type { AddonMap, InstallOptions, OptionMap } from './core/engine.ts';
export { officialAddons } from './addons/index.ts';
// Addon authoring API
export { defineAddon, defineAddonOptions } from './core/config.ts';

// options.ts - question types for addon options
export type {
	Question,
	OptionDefinition,
	OptionValues,
	BooleanQuestion,
	StringQuestion,
	NumberQuestion,
	SelectQuestion,
	MultiSelectQuestion,
	BaseQuestion
} from './core/options.ts';

// config.ts - addon definition and pipeline types
export type {
	Addon,
	SvApi,
	AddonDefinition,
	SetupResult,
	OptionBuilder,
	AddonInput,
	AddonSource,
	AddonReference,
	LoadedAddon,
	PreparedAddon,
	ConfiguredAddon,
	AddonResult
} from './core/config.ts';

// workspace.ts
export type { Workspace, WorkspaceOptions } from './core/workspace.ts';

export type { FileEditor, FileType } from './core/processors.ts';
