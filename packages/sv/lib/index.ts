export { create, type TemplateType, type LanguageType } from './create/index.ts';
export { add } from './addons/_engine/add.ts';
export type { AddonMap, InstallOptions, OptionMap } from './addons/_engine/add.ts';
export { officialAddons } from './addons/_engine/official.ts';
// Addon authoring API
export { defineAddon, defineAddonOptions } from './addon/config.ts';
export type * from './addon/processors.ts';
export type * from './addon/options.ts';
export type * from './addon/config.ts';
export type * from './addon/workspace.ts';
