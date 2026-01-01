import type {
	Addon,
	Workspace,
	PackageManager,
	OptionValues,
	Question,
	AddonSetupResult
} from '../core.ts';

export type AddonMap = Record<string, Addon<any>>;

export type OptionMap<Addons extends AddonMap> = {
	[K in keyof Addons]: Partial<OptionValues<Addons[K]['options']>>;
};

export type InstallOptions<Addons extends AddonMap> = {
	cwd: string;
	addons: Addons;
	options: OptionMap<Addons>;
	packageManager?: PackageManager;
};

export type ApplyAddonOptions = {
	addons: AddonMap;
	options: OptionMap<AddonMap>;
	workspace: Workspace;
	addonSetupResults: Record<string, AddonSetupResult>;
};

export type RunAddon = {
	workspace: Workspace;
	workspaceOptions: OptionValues<any>;
	addon: Addon<Record<string, Question>>;
	multiple: boolean;
};
