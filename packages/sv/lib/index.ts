export { create, type TemplateType, type LanguageType } from './create/index.ts';
export { add } from './cli/add/engine.ts';
export type { AddonMap, InstallOptions, OptionMap } from './cli/add/engine.ts';
export { officialAddons } from './officials/index.ts';
// Addon authoring API
export { defineAddon, defineAddonOptions } from './addon/config.ts';
export type * from './addon/processors.ts';
export type * from './addon/options.ts';
export type * from './addon/config.ts';
export type * from './addon/workspace.ts';
