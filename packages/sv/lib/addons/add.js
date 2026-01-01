import * as p from '@clack/prompts';
import { resolveCommand } from 'package-manager-detector';
import pc from 'picocolors';
import { exec } from 'tinyexec';

import { fileExists, installPackages, readFile, writeFile } from '../cli/add/utils.ts';
import { createWorkspace } from '../cli/add/workspace.ts';
import { TESTING } from '../cli/utils/env.ts';

/** @typedef {import('../core.ts').Addon<any>} Addon */
/** @typedef {import('./add.js').AddonMap} AddonMap */
/** @typedef {import('./add.js').ApplyAddonOptions} ApplyAddonOptions */
/** @typedef {import('./add.js').RunAddon} RunAddon */
/** @typedef {import('../core.ts').Workspace} Workspace */
/** @typedef {import('../core.ts').AddonSetupResult} AddonSetupResult */
/** @typedef {import('../core.ts').PackageManager} PackageManager */
/** @typedef {import('../core.ts').Question} Question */
/** @typedef {import('../core.ts').SvApi} SvApi */
/** @typedef {import('tinyexec').NonZeroExitError} NonZeroExitError */

/**
 * @template {AddonMap} Addons
 * @param {{
 *   cwd: string,
 *   addons: Addons,
 *   options: import('./add.js').OptionMap<Addons>,
 *   packageManager?: PackageManager
 * }} options
 * @returns {Promise<ReturnType<typeof applyAddons>>}
 */
export async function installAddon({ addons, cwd, options, packageManager = 'npm' }) {
	const workspace = await createWorkspace({ cwd, packageManager });
	const addonSetupResults = setupAddons(Object.values(addons), workspace);

	return await applyAddons({ addons, workspace, options, addonSetupResults });
}

/**
 * @param {ApplyAddonOptions} options
 * @returns {Promise<{
 *   filesToFormat: string[],
 *   pnpmBuildDependencies: string[],
 *   status: Record<string, string[] | 'success'>
 * }>}
 */
export async function applyAddons({ addons, workspace, addonSetupResults, options }) {
	/** @type {Set<string>} */
	const filesToFormat = new Set();
	/** @type {string[]} */
	const allPnpmBuildDependencies = [];
	/** @type {Record<string, string[] | 'success'>} */
	const status = {};

	const mapped = Object.entries(addons).map(([, addon]) => addon);
	const ordered = orderAddons(mapped, addonSetupResults);

	let hasFormatter = false;

	for (const addon of ordered) {
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

/**
 * @param {Array<Addon>} addons
 * @param {Workspace} workspace
 * @returns {Record<string, AddonSetupResult>}
 */
export function setupAddons(addons, workspace) {
	/** @type {Record<string, AddonSetupResult>} */
	const addonSetupResults = {};

	for (const addon of addons) {
		/** @type {AddonSetupResult} */
		const setupResult = {
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

/**
 * @param {RunAddon} options
 * @returns {Promise<{
 *   files: string[],
 *   pnpmBuildDependencies: string[],
 *   cancels: string[]
 * }>}
 */
async function runAddon({ addon, multiple, workspace, workspaceOptions }) {
	/** @type {Set<string>} */
	const files = new Set();

	// apply default addon options
	/** @type {import('../core.ts').OptionValues<any>} */
	const options = { ...workspaceOptions };
	for (const [id, question] of Object.entries(addon.options)) {
		// we'll only apply defaults to options that don't explicitly fail their conditions
		if (question.condition?.(options) !== false) {
			options[id] ??= question.default;
		}
	}

	/** @type {Array<{pkg: string, version: string, dev: boolean}>} */
	const dependencies = [];
	/** @type {string[]} */
	const pnpmBuildDependencies = [];
	/** @type {SvApi} */
	const sv = {
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
			const resolved = resolveCommand(workspace.packageManager, 'execute', commandArgs);
			if (!resolved) throw new Error('Failed to resolve command');
			const { command, args } = resolved;

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
				const typedError = /** @type {NonZeroExitError} */ (error);
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

	/** @type {string[]} */
	const cancels = [];
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

/**
 * Orders addons by putting addons that don't require any other addon in the front.
 * This is a drastic simplification, as this could still cause some inconvenient circumstances,
 * but works for now in contrary to the previous implementation
 *
 * @param {Array<Addon>} addons
 * @param {Record<string, AddonSetupResult>} setupResults
 * @returns {Array<Addon>}
 */
function orderAddons(addons, setupResults) {
	return addons.sort((a, b) => {
		return setupResults[a.id]?.runsAfter?.length - setupResults[b.id]?.runsAfter?.length;
	});
}
