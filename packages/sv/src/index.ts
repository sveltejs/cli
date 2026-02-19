export { create, type TemplateType, type LanguageType } from './create/index.ts';
export { add } from './core/engine.ts';
export type { AddonMap, InstallOptions, OptionMap } from './core/engine.ts';
export { officialAddons } from './addons/index.ts';
// Addon authoring API
export { defineAddon, defineAddonOptions } from './core/config.ts';
export type * from './core/processors.ts';
export type * from './core/options.ts';
export type * from './core/config.ts';
export type * from './core/workspace.ts';
