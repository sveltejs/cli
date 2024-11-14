import type {
	Adder,
	Workspace,
	PackageManager,
	OptionValues,
	Question,
	SvApi,
	AdderSetupResult,
	AdderWithoutExplicitArgs
} from '@sveltejs/cli-core';
import pc from 'picocolors';
import * as p from '@sveltejs/clack-prompts';
import { exec, NonZeroExitError } from 'tinyexec';
import { resolveCommand } from 'package-manager-detector';
import { TESTING } from '../utils/env.ts';
import { createWorkspace } from '../commands/add/workspace.ts';
import { fileExists, installPackages, readFile, writeFile } from '../commands/add/utils.ts';

type Addon = Adder<any>;
export type InstallOptions<Addons extends AddonMap> = {
	cwd: string;
	addons: Addons;
	options: OptionMap<Addons>;
	packageManager?: PackageManager;
};

export type AddonMap = Record<string, Addon>;
export type OptionMap<Addons extends AddonMap> = {
	[K in keyof Addons]: Partial<OptionValues<Addons[K]['options']>>;
};

export async function installAddon<Addons extends AddonMap>({
	addons,
	cwd,
	options,
	packageManager = 'npm'
}: InstallOptions<Addons>): Promise<string[]> {
	const workspace = createWorkspace({ cwd, packageManager });
	const adderSetupResults = setupAddons(Object.values(addons), workspace);

	return await applyAddons({ addons, workspace, options, adderSetupResults });
}

export type ApplyAddonOptions = {
	addons: AddonMap;
	options: OptionMap<AddonMap>;
	workspace: Workspace<any>;
	adderSetupResults: Record<string, AdderSetupResult>;
};
export async function applyAddons({
	addons,
	workspace,
	adderSetupResults,
	options
}: ApplyAddonOptions): Promise<string[]> {
	const filesToFormat = new Set<string>();

	const mapped = Object.entries(addons).map(([, addon]) => addon);
	const ordered = orderAddons(mapped, adderSetupResults);

	for (const addon of ordered) {
		workspace = createWorkspace({ ...workspace, options: options[addon.id] });

		const files = await runAddon(workspace, addon, ordered.length > 1);
		files.forEach((f) => filesToFormat.add(f));
	}

	return Array.from(filesToFormat);
}

export function setupAddons(
	addons: AdderWithoutExplicitArgs[],
	workspace: Workspace<any>
): Record<string, AdderSetupResult> {
	const adderSetupResults: Record<string, AdderSetupResult> = {};

	for (const addon of addons) {
		const setupResult: AdderSetupResult = { unsupported: [], dependsOn: [] };
		addon.setup?.({
			...workspace,
			dependsOn: (name) => setupResult.dependsOn.push(name),
			unsupported: (reason) => setupResult.unsupported.push(reason)
		});
		adderSetupResults[addon.id] = setupResult;
	}

	return adderSetupResults;
}

async function runAddon(
	workspace: Workspace<any>,
	addon: Adder<Record<string, Question>>,
	applyMultipleAddons: boolean
): Promise<string[]> {
	const files = new Set<string>();

	// apply default adder options
	for (const [id, question] of Object.entries(addon.options)) {
		// we'll only apply defaults to options that don't explicitly fail their conditions
		if (question.condition?.(workspace.options) !== false) {
			workspace.options[id] ??= question.default;
		}
	}

	const dependencies: Array<{ pkg: string; version: string; dev: boolean }> = [];
	const sv: SvApi = {
		file: (path, content) => {
			try {
				const exists = fileExists(workspace.cwd, path);
				let fileContent = exists ? readFile(workspace.cwd, path) : '';
				// process file
				fileContent = content(fileContent);
				if (!fileContent) return fileContent;

				writeFile(workspace, path, fileContent);
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

			const adderPrefix = applyMultipleAddons ? `${addon.id}: ` : '';
			const executedCommand = `${command} ${args.join(' ')}`;
			if (!TESTING) {
				p.log.step(`${adderPrefix}Running external command ${pc.gray(`(${executedCommand})`)}`);
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
		}
	};
	await addon.run({ ...workspace, sv });

	const pkgPath = installPackages(dependencies, workspace);
	files.add(pkgPath);

	return Array.from(files);
}

// sorts them to their execution order
function orderAddons(addons: Addon[], setupResults: Record<string, AdderSetupResult>) {
	return Array.from(addons).sort((a, b) => {
		const aDeps = setupResults[a.id].dependsOn;
		const bDeps = setupResults[b.id].dependsOn;

		if (!aDeps && !bDeps) return 0;
		if (!aDeps) return -1;
		if (!bDeps) return 1;

		if (aDeps.includes(b.id)) return 1;
		if (bDeps.includes(a.id)) return -1;

		return 0;
	});
}
