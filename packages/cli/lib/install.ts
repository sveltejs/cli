import type {
	Addon,
	Workspace,
	PackageManager,
	OptionValues,
	Question,
	SvApi,
	AddonSetupResult
} from '@sveltejs/cli-core';
import pc from 'picocolors';
import * as p from '@clack/prompts';
import { exec, NonZeroExitError } from 'tinyexec';
import { resolveCommand } from 'package-manager-detector';
import { TESTING } from '../utils/env.ts';
import { createWorkspace } from '../commands/add/workspace.ts';
import { fileExists, installPackages, readFile, writeFile } from '../commands/add/utils.ts';

export type InstallOptions<Addons extends AddonMap> = {
	cwd: string;
	addons: Addons;
	options: OptionMap<Addons>;
	packageManager?: PackageManager;
};

// @ts-expect-error TODO: this _should_ be `Addon<any>`, but the types won't infer properly with it
export type AddonMap = Record<string, Addon>;
export type OptionMap<Addons extends AddonMap> = {
	[K in keyof Addons]: Partial<OptionValues<Addons[K]['options']>>;
};

export async function installAddon<Addons extends AddonMap>({
	addons,
	cwd,
	options,
	packageManager = 'npm'
}: InstallOptions<Addons>): Promise<ReturnType<typeof applyAddons>> {
	const workspace = await createWorkspace({ cwd, packageManager });
	const addonSetupResults = setupAddons(Object.values(addons), workspace);

	return await applyAddons({ addons, workspace, options, addonSetupResults });
}

export type ApplyAddonOptions = {
	addons: AddonMap;
	options: OptionMap<AddonMap>;
	workspace: Workspace;
	addonSetupResults: Record<string, AddonSetupResult>;
};
export async function applyAddons({
	addons,
	workspace,
	addonSetupResults,
	options
}: ApplyAddonOptions): Promise<{
	filesToFormat: string[];
	pnpmBuildDependencies: string[];
	status: Record<string, string[] | 'success'>;
}> {
	const filesToFormat = new Set<string>();
	const allPnpmBuildDependencies: string[] = [];
	const status: Record<string, string[] | 'success'> = {};

	const mapped = Object.entries(addons).map(([, addon]) => addon);
	const ordered = orderAddons(mapped, addonSetupResults);

	for (const addon of ordered) {
		const workspaceOptions = options[addon.id] || {};

		// reload workspace for every addon, as previous addons might have changed it
		const addonWorkspace = await createWorkspace({
			cwd: workspace.cwd,
			packageManager: workspace.packageManager
		});

		const { files, pnpmBuildDependencies, cancels } = await runAddon({
			workspace: addonWorkspace,
			workspaceOptions,
			addon,
			multiple: ordered.length > 1
		});

		files.forEach((f) => filesToFormat.add(f));
		pnpmBuildDependencies.forEach((s) => allPnpmBuildDependencies.push(s));
		if (cancels.length === 0) {
			status[addon.id] = 'success';
		} else {
			status[addon.id] = cancels;
		}
	}

	return {
		filesToFormat: Array.from(filesToFormat),
		pnpmBuildDependencies: allPnpmBuildDependencies,
		status
	};
}

export function setupAddons(
	addons: Array<Addon<any>>,
	workspace: Workspace
): Record<string, AddonSetupResult> {
	const addonSetupResults: Record<string, AddonSetupResult> = {};

	for (const addon of addons) {
		const setupResult: AddonSetupResult = {
			unsupported: [],
			dependsOn: [],
			runsAfter: []
		};
		addon.setup?.({
			...workspace,
			dependsOn: (name) => {
				setupResult.dependsOn.push(name);
				setupResult.runsAfter.push(name);
			},
			unsupported: (reason) => setupResult.unsupported.push(reason),
			runsAfter: (name) => setupResult.runsAfter.push(name)
		});
		addonSetupResults[addon.id] = setupResult;
	}

	return addonSetupResults;
}

type RunAddon = {
	workspace: Workspace;
	workspaceOptions: OptionValues<any>;
	addon: Addon<Record<string, Question>>;
	multiple: boolean;
};
async function runAddon({ addon, multiple, workspace, workspaceOptions }: RunAddon) {
	const files = new Set<string>();

	// apply default addon options
	const options: OptionValues<any> = { ...workspaceOptions };
	for (const [id, question] of Object.entries(addon.options)) {
		// we'll only apply defaults to options that don't explicitly fail their conditions
		if (question.condition?.(options) !== false) {
			options[id] ??= question.default;
		}
	}

	const dependencies: Array<{ pkg: string; version: string; dev: boolean }> = [];
	const pnpmBuildDependencies: string[] = [];
	const sv: SvApi = {
		file: (path, content) => {
			try {
				const exists = fileExists(workspace.cwd, path);
				let fileContent = exists ? readFile(workspace.cwd, path) : '';
				// process file
				fileContent = content(fileContent);
				if (!fileContent) return fileContent;

				// TODO: fix https://github.com/rolldown/tsdown/issues/575 to remove the `replaceAll`
				writeFile(workspace, path, fileContent.replaceAll('<\\/script>', '</script>'));
				files.add(path);
			} catch (e) {
				if (e instanceof Error) {
					throw new Error(`Unable to process '${path}'. Reason: ${e.message}`);
				}
				throw e;
			}
		},
		execute: async (commandArgs, stdio) => {
			const { command, args } = resolveCommand(workspace.packageManager, 'execute', commandArgs)!;

			const addonPrefix = multiple ? `${addon.id}: ` : '';
			const executedCommand = `${command} ${args.join(' ')}`;
			if (!TESTING) {
				p.log.step(`${addonPrefix}Running external command ${pc.gray(`(${executedCommand})`)}`);
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
					cause: typedError.output
				});
			}
		},
		dependency: (pkg, version) => {
			dependencies.push({ pkg, version, dev: false });
		},
		devDependency: (pkg, version) => {
			dependencies.push({ pkg, version, dev: true });
		},
		pnpmBuildDependency: (pkg) => {
			pnpmBuildDependencies.push(pkg);
		}
	};

	const cancels: string[] = [];
	await addon.run({
		cancel: (reason) => {
			cancels.push(reason);
		},
		...workspace,
		options,
		sv
	});

	if (cancels.length === 0) {
		const pkgPath = installPackages(dependencies, workspace);
		files.add(pkgPath);
	}

	return {
		files: Array.from(files),
		pnpmBuildDependencies,
		cancels
	};
}

// orders addons by putting addons that don't require any other addon in the front.
// This is a drastic simplification, as this could still cause some inconvenient circumstances,
// but works for now in contrary to the previous implementation
function orderAddons(addons: Array<Addon<any>>, setupResults: Record<string, AddonSetupResult>) {
	return addons.sort((a, b) => {
		return setupResults[a.id]?.runsAfter?.length - setupResults[b.id]?.runsAfter?.length;
	});
}
