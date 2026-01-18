import * as p from '@clack/prompts';
import { resolveCommand } from 'package-manager-detector';
import pc from 'picocolors';
import { NonZeroExitError, exec } from 'tinyexec';

import { AddonSpec } from '../cli/add/index.ts';
import { fileExists, installPackages, readFile, writeFile } from '../cli/add/utils.ts';
import { createWorkspace } from '../cli/add/workspace.ts';
import { TESTING } from '../cli/utils/env.ts';
import type {
	Addon,
	AddonSetupResult,
	OptionValues,
	PackageManager,
	ResolvedAddon,
	SvApi,
	Workspace
} from '../core.ts';

export type InstallOptions<Addons extends AddonMap> = {
	cwd: string;
	addons: Addons;
	options: OptionMap<Addons>;
	packageManager?: PackageManager;
};

export type AddonMap = Record<string, Addon<any>>;
export type OptionMap<Addons extends AddonMap> = {
	[K in keyof Addons]: Partial<OptionValues<Addons[K]['options']>>;
};

export async function add<Addons extends AddonMap>({
	addons,
	cwd,
	options,
	packageManager = 'npm'
}: InstallOptions<Addons>): Promise<ReturnType<typeof applyAddons>> {
	const workspace = await createWorkspace({ cwd, packageManager });

	// Create AddonSpec objects for the programmatic API (all are "official" type for error hints)
	const addonSpecs = Object.values(addons).map(
		(addon) =>
			new AddonSpec({
				specifier: addon.id,
				id: addon.id,
				options: [],
				kind: 'official',
				addon
			})
	);

	const addonSetupResults = setupAddons(addonSpecs, workspace);

	return await applyAddons({ addonSpecs, workspace, options, addonSetupResults });
}

export type ApplyAddonOptions = {
	addonSpecs: AddonSpec[];
	options: OptionMap<AddonMap>;
	workspace: Workspace;
	addonSetupResults: Record<string, AddonSetupResult>;
};
export async function applyAddons({
	addonSpecs,
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

	const addons = addonSpecs.map((s) => s.addon!);
	const ordered = orderAddons(addons, addonSetupResults);

	let hasFormatter = false;

	for (const addon of ordered) {
		const spec = addonSpecs.find((s) => s.id === addon.id)!;
		const workspaceOptions = options[addon.id] || {};

		// reload workspace for every addon, as previous addons might have changed it
		const addonWorkspace = await createWorkspace({
			cwd: workspace.cwd,
			packageManager: workspace.packageManager
		});
		// If we don't have a formatter yet, check if the addon adds one
		if (!hasFormatter) hasFormatter = !!addonWorkspace.dependencyVersion('prettier');

		const { files, pnpmBuildDependencies, cancels } = await runAddon({
			workspace: addonWorkspace,
			workspaceOptions,
			addon,
			spec,
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
		filesToFormat: hasFormatter ? Array.from(filesToFormat) : [],
		pnpmBuildDependencies: allPnpmBuildDependencies,
		status
	};
}

/** Setup addons - accepts either AddonSpec[] or ResolvedAddon[] */
export function setupAddons(
	input: AddonSpec[] | ResolvedAddon[],
	workspace: Workspace
): Record<string, AddonSetupResult> {
	// Normalize to AddonSpec[] - if input is ResolvedAddon[], convert to specs
	const specs: AddonSpec[] =
		input.length > 0 && input[0] instanceof AddonSpec
			? (input as AddonSpec[])
			: (input as ResolvedAddon[]).map((addon) => AddonSpec.fromAddon(addon));

	const addonSetupResults: Record<string, AddonSetupResult> = {};

	for (const spec of specs) {
		const addon = spec.addon!;
		const setupResult: AddonSetupResult = {
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
			throw new Error(`Add-on '${addon.id}' failed during setup: ${msg}\n\n${spec.getErrorHint()}`);
		}
		addonSetupResults[addon.id] = setupResult;
	}

	return addonSetupResults;
}

type RunAddon = {
	workspace: Workspace;
	workspaceOptions: OptionValues<any>;
	addon: ResolvedAddon;
	spec: AddonSpec;
	multiple: boolean;
};
async function runAddon({ addon, spec, multiple, workspace, workspaceOptions }: RunAddon) {
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

				// FIXME: https://github.com/rolldown/tsdown/issues/575 to remove the `replaceAll`
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
		throw new Error(`Add-on '${addon.id}' failed during run: ${msg}\n\n${spec.getErrorHint()}`);
	}

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
