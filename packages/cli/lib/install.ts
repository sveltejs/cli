import { exec } from 'tinyexec';
import { resolveCommand } from 'package-manager-detector';
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
import { fileExists, installPackages, readFile, writeFile } from '../commands/add/utils.ts';
import { createWorkspace } from '../commands/add/workspace.ts';
import * as p from '@sveltejs/clack-prompts';
import pc from 'picocolors';
import { TESTING } from '../utils/env.ts';

type Addon = Adder<any>;
export type InstallOptions<Addons extends AddonMap> = {
	cwd: string;
	addons: Addons;
	options: OptionMap<Addons>;
	packageManager: PackageManager;
	adderSetupResults?: Record<string, AdderSetupResult>;
};

export type AddonMap = Record<string, Addon>;
export type OptionMap<Addons extends AddonMap> = {
	[K in keyof Addons]: Partial<OptionValues<Addons[K]['options']>>;
};

export async function installAddon<Addons extends AddonMap>({
	addons,
	cwd,
	options,
	packageManager = 'npm',
	adderSetupResults
}: InstallOptions<Addons>): Promise<string[]> {
	const filesToFormat = new Set<string>();

	adderSetupResults ??= setupAddons(Object.values(addons), cwd, packageManager);

	const mapped = Object.entries(addons).map(([, addon]) => addon);
	const ordered = orderAddons(mapped, adderSetupResults);

	for (const addon of ordered) {
		const workspace = createWorkspace({ cwd, packageManager });
		workspace.options = options[addon.id];

		const files = await runAddon(workspace, addon, ordered.length > 1);
		files.forEach((f) => filesToFormat.add(f));
	}

	return Array.from(filesToFormat);
}

export function setupAddons(
	addons: AdderWithoutExplicitArgs[],
	cwd: string,
	packageManager?: PackageManager
): Record<string, AdderSetupResult> {
	const adderSetupResults: Record<string, AdderSetupResult> = {};
	const workspace = createWorkspace({ cwd, packageManager });

	for (const addon of addons) {
		const setupResult: AdderSetupResult = {
			available: true,
			dependsOn: []
		};
		addon.setup?.({
			...workspace,
			dependsOn: (name) => setupResult.dependsOn.push(name),
			unavailable: () => (setupResult.available = false)
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
	for (const [, question] of Object.entries(addon.options)) {
		// we'll only apply defaults to options that don't explicitly fail their conditions
		if (question.condition?.(workspace.options) !== false) {
			workspace.options ??= question.default;
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

				return fileContent;
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
			const executedCommandDisplayName = `${command} ${args.join(' ')}`;
			if (!TESTING) {
				p.log.step(
					`${adderPrefix}Running external command ${pc.gray(`(${executedCommandDisplayName})`)}`
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
				const typedError = error as Error;
				throw new Error(
					`Failed to execute scripts '${executedCommandDisplayName}': ` + typedError.message
				);
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
function orderAddons(addons: Addon[], adderSetupResults: Record<string, AdderSetupResult>) {
	return Array.from(addons).sort((a, b) => {
		const aDeps = adderSetupResults[a.id].dependsOn;
		const bDeps = adderSetupResults[b.id].dependsOn;

		if (!aDeps && !bDeps) return 0;
		if (!aDeps) return -1;
		if (!bDeps) return 1;

		if (aDeps.includes(b.id)) return 1;
		if (bDeps.includes(a.id)) return -1;

		return 0;
	});
}
