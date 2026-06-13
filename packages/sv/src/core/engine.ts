import * as p from '@clack/prompts';
import {
	color,
	fileExists,
	loadFile,
	loadPackageJson,
	parse,
	saveFile,
	resolveCommand,
	type AgentName
} from '@sveltejs/sv-utils';
import fs from 'node:fs';
import path from 'node:path';
import { NonZeroExitError, exec } from 'tinyexec';
import { createLoadedAddon } from '../cli/add.ts';
import { filePaths } from './common.ts';
import {
	getErrorHint,
	type Addon,
	type AddonDefinition,
	type FileEdit,
	type LoadedAddon,
	type OptionValues,
	type SetupResult,
	type SvApi
} from './config.ts';
import { svDeprecated } from './deprecated.ts';
import { TESTING } from './env.ts';
import { addPnpmAllowBuilds } from './package-manager.ts';
import { createWorkspace, type Workspace } from './workspace.ts';

function alphabetizeRecord(obj: Record<string, string>) {
	const ordered: Record<string, string> = {};
	for (const [key, value] of Object.entries(obj).sort(([a], [b]) => a.localeCompare(b))) {
		ordered[key] = value;
	}
	return ordered;
}

function updatePackages(
	dependencies: Array<{ pkg: string; version: string; dev: boolean }>,
	cwd: string
): string {
	const { source } = loadPackageJson(cwd);
	const { data, generateCode } = parse.json(source);

	for (const dependency of dependencies) {
		if (dependency.dev) {
			data.devDependencies ??= {};
			data.devDependencies[dependency.pkg] = dependency.version;
		} else {
			data.dependencies ??= {};
			data.dependencies[dependency.pkg] = dependency.version;
		}
	}

	if (data.dependencies) data.dependencies = alphabetizeRecord(data.dependencies);
	if (data.devDependencies) data.devDependencies = alphabetizeRecord(data.devDependencies);

	saveFile(cwd, filePaths.packageJson, generateCode());
	return filePaths.packageJson;
}

export type InstallOptions<Addons extends AddonMap> = {
	cwd: string;
	addons: Addons;
	options: OptionMap<Addons>;
	packageManager?: AgentName;
};

export type AddonMap = Record<string, Addon<any, any>>;

type AddonById<Addons extends AddonMap, Id extends string> = Extract<
	Addons[keyof Addons],
	{ id: Id }
>;

export type OptionMap<Addons extends AddonMap> = {
	[Id in Addons[keyof Addons]['id']]: Partial<OptionValues<AddonById<Addons, Id>['options']>>;
};

export async function add<Addons extends AddonMap>({
	addons,
	cwd,
	options,
	packageManager = 'npm'
}: InstallOptions<Addons>): Promise<ReturnType<typeof applyAddons>> {
	const workspace = await createWorkspace({ cwd, packageManager });

	// Create LoadedAddon objects for the programmatic API
	const loadedAddons: LoadedAddon[] = Object.values(addons).map((addon) =>
		createLoadedAddon(addon as AddonDefinition)
	);

	const setupResults = setupAddons(loadedAddons, workspace);

	return await applyAddons({ loadedAddons, workspace, options, setupResults });
}

export type ApplyAddonOptions = {
	loadedAddons: LoadedAddon[];
	options: OptionMap<AddonMap>;
	workspace: Workspace;
	setupResults: Record<string, SetupResult>;
};
export async function applyAddons({
	loadedAddons,
	workspace,
	setupResults,
	options
}: ApplyAddonOptions): Promise<{
	filesToFormat: string[];
	status: Record<string, string[] | 'success'>;
}> {
	const filesToFormat = new Set<string>();
	const status: Record<string, string[] | 'success'> = {};
	const canceledAddons = new Set<string>();

	const addonDefs = loadedAddons.map((l) => l.addon);
	const ordered = orderAddons(addonDefs, setupResults);

	let hasFormatter = false;

	for (const addon of ordered) {
		// Skip addons whose `dependsOn` dependency was canceled. Running them would
		// fail with misleading errors since they expect state from the canceled addon.
		const dependsOn = setupResults[addon.id]?.dependsOn ?? [];
		const canceledDeps = dependsOn.filter((dep) => canceledAddons.has(dep));
		if (canceledDeps.length > 0) {
			canceledAddons.add(addon.id);
			status[addon.id] = canceledDeps.map((dep) => `Because dependency '${dep}' was canceled`);
			continue;
		}

		const loaded = loadedAddons.find((l) => l.addon.id === addon.id)!;
		const workspaceOptions = options[addon.id] || {};

		// reload workspace for every addon, as previous addons might have changed it
		const addonWorkspace = await createWorkspace({
			cwd: workspace.cwd,
			packageManager: workspace.packageManager
		});
		// If we don't have a formatter yet, check if the addon adds one
		if (!hasFormatter) hasFormatter = !!addonWorkspace.dependencyVersion('prettier');

		const { files, cancels } = await runAddon({
			workspace: addonWorkspace,
			workspaceOptions,
			addon,
			loaded,
			multiple: ordered.length > 1
		});

		files.forEach((f) => filesToFormat.add(f));
		if (cancels.length === 0) {
			status[addon.id] = 'success';
		} else {
			canceledAddons.add(addon.id);
			status[addon.id] = cancels;
		}
	}

	return {
		filesToFormat: hasFormatter ? Array.from(filesToFormat) : [],
		status
	};
}

/** Setup addons - takes LoadedAddon[] and returns setup results */
export function setupAddons(
	loadedAddons: LoadedAddon[],
	workspace: Workspace
): Record<string, SetupResult> {
	const setupResults: Record<string, SetupResult> = {};

	for (const loaded of loadedAddons) {
		const addon = loaded.addon;
		const setupResult: SetupResult = {
			unsupported: [],
			dependsOn: [],
			runsAfter: []
		};
		try {
			addon.setup?.({
				...workspace,
				dependsOn: (name) => {
					setupResult.dependsOn.push(name);
					setupResult.runsAfter.push(name);
				},
				unsupported: (reason) => setupResult.unsupported.push(reason),
				runsAfter: (name) => setupResult.runsAfter.push(name)
			});
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			throw new Error(
				`Add-on '${addon.id}' failed during setup: ${msg}\n\n${getErrorHint(loaded.reference.source)}`,
				{ cause: err }
			);
		}
		setupResults[addon.id] = setupResult;
	}

	return setupResults;
}

type RunAddon = {
	workspace: Workspace;
	workspaceOptions: OptionValues<any>;
	addon: AddonDefinition;
	loaded: LoadedAddon;
	multiple: boolean;
};
async function runAddon({ addon, loaded, multiple, workspace, workspaceOptions }: RunAddon) {
	const files = new Set<string>();

	// apply default addon options
	const options: OptionValues<any> = { ...workspaceOptions };
	for (const [id, question] of Object.entries(addon.options)) {
		// we'll only apply defaults to options that don't explicitly fail their conditions
		if (question.condition?.(options) !== false) {
			options[id] ??= question.default;
		}
	}

	const { sv, updateDependencies } = prepareSvApi(
		workspace,
		files,
		multiple ? `${addon.id}: ` : ''
	);

	const cancels: string[] = [];
	try {
		await addon.run({
			cancel: (reason) => {
				cancels.push(reason);
			},
			...workspace,
			options,
			sv
		});
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		throw new Error(
			`Add-on '${addon.id}' failed during run: ${msg}\n\n${getErrorHint(loaded.reference.source)}`,
			{ cause: err }
		);
	}

	if (cancels.length === 0) {
		const pkgPath = updateDependencies();
		files.add(pkgPath);
	}

	return {
		files: Array.from(files),
		cancels
	};
}

function editFile(
	file: string,
	edit: FileEdit,
	workspace: Workspace,
	files: Set<string>,
	include?: (content: string) => boolean
) {
	try {
		const exists = fileExists(workspace.cwd, file);
		if (exists && !fs.statSync(path.resolve(workspace.cwd, file)).isFile()) return;

		const content = exists ? loadFile(workspace.cwd, file) : '';
		const skip = include === undefined ? false : !include(content);
		if (skip) return;

		const editedContent = edit(content);
		if (editedContent === '' || editedContent === false) return;

		saveFile(workspace.cwd, file, editedContent);
		files.add(file);
	} catch (e) {
		if (e instanceof Error) {
			e.message = `Unable to process '${file}'. Reason: ${e.message}`;
		}
		throw e;
	}
}

export function prepareSvApi(
	workspace: Workspace,
	files: Set<string>,
	executeOutputPrefix: string | undefined = undefined
): { sv: SvApi; updateDependencies: () => string } {
	const dependencies: Array<{ pkg: string; version: string; dev: boolean }> = [];

	const sv: SvApi = {
		file: (path, edit) => {
			editFile(path, edit, workspace, files);
		},
		files: (options, edit) => {
			const { include, exclude } = options;
			const globbedFiles = fs.globSync(include, {
				cwd: workspace.cwd,
				exclude: ['node_modules/**', '**/node_modules/**', '.*/**', '**/.*/**', ...(exclude ?? [])]
			});

			for (const file of globbedFiles) {
				editFile(file, edit, workspace, files, options.where);
			}
		},
		execute: async (commandArgs, stdio) => {
			const { command, args } = resolveCommand(workspace.packageManager, 'execute', commandArgs)!;

			const executedCommand = [command, ...args].join(' ');
			if (!TESTING) {
				p.log.step(
					`${executeOutputPrefix}Running external command ${color.optional(`(${executedCommand})`)}`
				);
			}

			// adding --yes as the first parameter helps avoiding the "Need to install the following packages:" message
			if (workspace.packageManager === 'npm') args.unshift('--yes');

			try {
				await exec(command, args, {
					nodeOptions: { cwd: workspace.cwd, stdio: TESTING ? 'pipe' : stdio },
					throwOnError: true
				});
			} catch (error) {
				const typedError = error as NonZeroExitError;
				throw new Error(`Failed to execute scripts '${executedCommand}': ${typedError.message}`, {
					cause: error
				});
			}
		},
		dependency: (pkg, version) => {
			dependencies.push({ pkg, version, dev: false });
		},
		devDependency: (pkg, version) => {
			dependencies.push({ pkg, version, dev: true });
		},
		/** @deprecated use `pnpm.allowBuilds` from `@sveltejs/sv-utils` instead */
		pnpmBuildDependency: (pkg) => {
			svDeprecated(
				'use `pnpm.allowBuilds` from `@sveltejs/sv-utils` instead of `sv.pnpmBuildDependency`'
			);
			addPnpmAllowBuilds(workspace.cwd, workspace.packageManager, pkg);
		}
	};
	return { sv, updateDependencies: () => updatePackages(dependencies, workspace.cwd) };
}

// orders addons by putting addons that don't require any other addon in the front.
// This is a drastic simplification, as this could still cause some inconvenient circumstances,
// but works for now in contrary to the previous implementation
export function orderAddons(
	addons: Array<Addon<any>>,
	setupResults: Record<string, SetupResult>
): Array<Addon<any>> {
	return addons.sort((a, b) => {
		return setupResults[a.id]?.runsAfter?.length - setupResults[b.id]?.runsAfter?.length;
	});
}
