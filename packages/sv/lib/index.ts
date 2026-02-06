export { create, type TemplateType, type LanguageType } from './create/index.ts';
export { add } from './utils/engine.ts';
export type { AddonMap, InstallOptions, OptionMap } from './utils/engine.ts';
export { officialAddons } from './addons/index.ts';
// Addon authoring API
export { defineAddon, defineAddonOptions } from './utils/config.ts';
export type * from './utils/processors.ts';
export type * from './utils/options.ts';
export type * from './utils/config.ts';
export type * from './utils/workspace.ts';
