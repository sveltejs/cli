import { exec } from 'tinyexec';
import { resolveCommand } from 'package-manager-detector';
import type { Adder, Workspace, PackageManager, OptionValues, Question } from '@sveltejs/cli-core';
import { installPackages } from '../commands/add/utils.ts';
import { createWorkspace } from '../commands/add/workspace.ts';
import { createOrUpdateFiles } from '../commands/add/processor.ts';

type Addon = Adder<any>;
export type InstallOptions<Addons extends AddonMap> = {
	cwd: string;
	addons: Addons;
	options: OptionMap<Addons>;
	packageManager: PackageManager;
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
	const filesToFormat = new Set<string>();

	const mapped = Object.entries(addons).map(([, addon]) => addon);
	const ordered = orderAddons(mapped);

	for (const addon of ordered) {
		const workspace = createWorkspace({ cwd, packageManager });
		workspace.options = options[addon.id];

		const files = await runAddon(workspace, addon);
		files.forEach((f) => filesToFormat.add(f));
	}

	return Array.from(filesToFormat);
}

async function runAddon(
	workspace: Workspace<any>,
	addon: Adder<Record<string, Question>>
): Promise<string[]> {
	const files = new Set<string>();

	// apply default adder options
	for (const [, question] of Object.entries(addon.options)) {
		// we'll only apply defaults to options that don't explicitly fail their conditions
		if (question.condition?.(workspace.options) !== false) {
			workspace.options ??= question.default;
		}
	}

	await addon.preInstall?.(workspace);
	const pkgPath = installPackages(addon, workspace);
	files.add(pkgPath);
	const changedFiles = createOrUpdateFiles(addon.files, workspace);
	changedFiles.forEach((file) => files.add(file));
	await addon.postInstall?.(workspace);

	for (const script of addon.scripts ?? []) {
		if (script.condition?.(workspace) === false) continue;

		try {
			const { args, command } = resolveCommand(workspace.packageManager, 'execute', script.args)!;
			if (workspace.packageManager === 'npm') args.unshift('--yes');
			await exec(command, args, {
				nodeOptions: { cwd: workspace.cwd, stdio: 'inherit' },
				throwOnError: true
			});
		} catch (error) {
			const typedError = error as Error;
			throw new Error(`Failed to execute scripts '${script.description}': ` + typedError.message);
		}
	}

	return Array.from(files);
}

// sorts them to their execution order
function orderAddons(addons: Addon[]) {
	return Array.from(addons).sort((a, b) => {
		if (!a.dependsOn && !b.dependsOn) return 0;
		if (!a.dependsOn) return -1;
		if (!b.dependsOn) return 1;

		if (a.dependsOn.includes(b.id)) return 1;
		if (b.dependsOn.includes(a.id)) return -1;

		return 0;
	});
}
