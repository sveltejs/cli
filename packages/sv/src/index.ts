export { create, type TemplateType, type LanguageType } from './create/index.ts';
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
