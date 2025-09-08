import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import pc from 'picocolors';
import * as v from 'valibot';
import * as pkg from 'empathic/package';
import * as p from '@clack/prompts';
import { Command } from 'commander';
import {
	officialAddons,
	getAddonDetails,
	communityAddonIds,
	getCommunityAddon
} from '@sveltejs/addons';
import type { AgentName } from 'package-manager-detector';
import type { AddonWithoutExplicitArgs, OptionValues, PackageManager } from '@sveltejs/cli-core';
import * as common from '../../utils/common.ts';
import { createWorkspace } from './workspace.ts';
import { formatFiles, getHighlighter } from './utils.ts';
import { Directive, downloadPackage, getPackageJSON } from './fetch-packages.ts';
import {
	addPnpmBuildDependencies,
	AGENT_NAMES,
	installDependencies,
	installOption,
	packageManagerPrompt
} from '../../utils/package-manager.ts';
import { verifyCleanWorkingDirectory, verifyUnsupportedAddons } from './verifiers.ts';
import { type AddonMap, applyAddons, setupAddons } from '../../lib/install.ts';

const aliases = officialAddons.map((c) => c.alias).filter((v) => v !== undefined);
const addonOptions = getAddonOptionFlags();
const communityDetails: AddonWithoutExplicitArgs[] = [];

const AddonsSchema = v.array(v.string());
const OptionsSchema = v.strictObject({
	cwd: v.string(),
	install: v.union([v.boolean(), v.picklist(AGENT_NAMES)]),
	gitCheck: v.boolean(),
	community: v.optional(v.union([AddonsSchema, v.boolean()])),
	addons: v.record(v.string(), v.optional(v.array(v.string())))
});
type Options = v.InferOutput<typeof OptionsSchema>;

type AddonArgs = { id: string; options: string[] | undefined };

// infers the workspace cwd if a `package.json` resides in a parent directory
const defaultPkgPath = pkg.up();
const defaultCwd = defaultPkgPath ? path.dirname(defaultPkgPath) : undefined;
export const add = new Command('add')
	.description('applies specified add-ons into a project')
	.argument('[add-on...]', `add-ons to install`, (value, prev: AddonArgs[] = []) => {
		const [addonId, optionFlags] = value.split('=', 2);

		// validates that there are no repeated add-ons (e.g. `sv add foo=demo:yes foo=demo:no`)
		const repeatedAddons = prev.find(({ id }) => id === addonId);
		if (repeatedAddons) {
			console.error(`Malformed arguments: Add-on '${addonId}' is repeated multiple times.`);
			process.exit(1);
		}

		try {
			const options = common.parseAddonOptions(optionFlags);
			prev.push({ id: addonId, options });
		} catch (error) {
			if (error instanceof Error) {
				console.error(error.message);
			}
			process.exit(1);
		}

		return prev;
	})
	.option('-C, --cwd <path>', 'path to working directory', defaultCwd)
	.option('--no-git-check', 'even if some files are dirty, no prompt will be shown')
	.option('--no-install', 'skip installing dependencies')
	.addOption(installOption)
	//.option('--community [add-on...]', 'community addons to install')
	.configureHelp({
		...common.helpConfig,
		formatHelp(cmd, helper) {
			const termWidth = helper.padWidth(cmd, helper);
			const helpWidth = helper.helpWidth ?? 80; // in case prepareContext() was not called

			function callFormatItem(term: string, description: string) {
				return helper.formatItem(term, termWidth, description, helper);
			}

			// Usage
			let output = [
				`${helper.styleTitle('Usage:')} ${helper.styleUsage(helper.commandUsage(cmd))}`,
				''
			];

			// Description
			const commandDescription = helper.commandDescription(cmd);
			if (commandDescription.length > 0) {
				output = output.concat([
					helper.boxWrap(helper.styleCommandDescription(commandDescription), helpWidth),
					''
				]);
			}

			// Arguments
			const argumentList = helper.visibleArguments(cmd).map((argument) => {
				return callFormatItem(
					helper.styleArgumentTerm(helper.argumentTerm(argument)),
					helper.styleArgumentDescription(helper.argumentDescription(argument))
				);
			});
			if (argumentList.length > 0) {
				output = output.concat([helper.styleTitle('Arguments:'), ...argumentList, '']);
			}

			// Addon Options
			const addonList = addonOptions.map((option) => {
				// const description = `${pc.dim(`(preset: ${option.preset})`)}\n${option.choices}`;
				const description = option.choices;
				return callFormatItem(
					helper.styleArgumentTerm(option.id),
					helper.styleArgumentDescription(description)
				);
			});
			if (addonList.length > 0) {
				output = output.concat([helper.styleTitle('Add-On Options:'), ...addonList, '']);
			}

			// Options
			const optionList = helper.visibleOptions(cmd).map((option) => {
				return callFormatItem(
					helper.styleOptionTerm(helper.optionTerm(option)),
					helper.styleOptionDescription(helper.optionDescription(option))
				);
			});
			if (optionList.length > 0) {
				output = output.concat([helper.styleTitle('Options:'), ...optionList, '']);
			}

			if (helper.showGlobalOptions) {
				const globalOptionList = helper.visibleGlobalOptions(cmd).map((option) => {
					return callFormatItem(
						helper.styleOptionTerm(helper.optionTerm(option)),
						helper.styleOptionDescription(helper.optionDescription(option))
					);
				});
				if (globalOptionList.length > 0) {
					output = output.concat([helper.styleTitle('Global Options:'), ...globalOptionList, '']);
				}
			}

			// Commands
			const commandList = helper.visibleCommands(cmd).map((cmd) => {
				return callFormatItem(
					helper.styleSubcommandTerm(helper.subcommandTerm(cmd)),
					helper.styleSubcommandDescription(helper.subcommandDescription(cmd))
				);
			});
			if (commandList.length > 0) {
				output = output.concat([helper.styleTitle('Commands:'), ...commandList, '']);
			}

			return output.join('\n');
		}
	})
	.action((addonArgs: AddonArgs[], opts) => {
		// validate workspace
		if (opts.cwd === undefined) {
			console.error(
				'Invalid workspace: Please verify that you are inside of a Svelte project. You can also specify the working directory with `--cwd <path>`'
			);
			process.exit(1);
		} else if (!fs.existsSync(path.resolve(opts.cwd, 'package.json'))) {
			// when `--cwd` is specified, we'll validate that it's a valid workspace
			console.error(
				`Invalid workspace: Path '${path.resolve(opts.cwd)}' is not a valid workspace.`
			);
			process.exit(1);
		}

		const addonIds = officialAddons.map((addon) => addon.id);
		const invalidAddons = addonArgs
			.filter(({ id }) => !addonIds.includes(id) && !aliases.includes(id))
			.map(({ id }) => id);
		if (invalidAddons.length > 0) {
			console.error(`Invalid add-ons specified: ${invalidAddons.join(', ')}`);
			process.exit(1);
		}

		const options = v.parse(OptionsSchema, { ...opts, addons: {} });
		const selectedAddons = transformAliases(addonArgs);
		selectedAddons.forEach((addon) => (options.addons[addon.id] = addon.options));

		common.runCommand(async () => {
			const selectedAddonIds = selectedAddons.map(({ id }) => id);
			const { nextSteps } = await runAddCommand(options, selectedAddonIds);
			if (nextSteps.length > 0) {
				p.note(nextSteps.join('\n'), 'Next steps', { format: (line) => line });
			}
		});
	});

type SelectedAddon = { type: 'official' | 'community'; addon: AddonWithoutExplicitArgs };
export async function runAddCommand(
	options: Options,
	selectedAddonIds: string[]
): Promise<{ nextSteps: string[]; packageManager?: AgentName | null }> {
	const selectedAddons: SelectedAddon[] = selectedAddonIds.map((id) => ({
		type: 'official',
		addon: getAddonDetails(id)
	}));

	type AddonId = string;
	type QuestionValues = OptionValues<any>;
	type AddonOption = Record<AddonId, QuestionValues>;

	const official: AddonOption = {};
	const community: AddonOption = {};

	// apply specified options from flags
	for (const addonOption of addonOptions) {
		const addonId = addonOption.id;
		const specifiedOptions = options.addons[addonId];
		if (!specifiedOptions) continue;

		const details = getAddonDetails(addonId);
		if (!selectedAddons.find((d) => d.addon === details)) {
			selectedAddons.push({ type: 'official', addon: details });
		}

		official[addonId] ??= {};

		const optionEntries = Object.entries(details.options);
		for (const option of specifiedOptions) {
			let [optionId, optionValue] = option.split(':', 2);

			// validates that the option exists
			const optionEntry = optionEntries.find(
				([id, question]) => id === optionId || question.group === optionId
			);
			if (!optionEntry) {
				const { choices } = getOptionChoices(details);
				throw new Error(
					`Invalid '${addonId}' option: '${option}'\nAvailable options: ${choices.join(', ')}`
				);
			}

			const [questionId, question] = optionEntry;

			// multiselect options can be specified with a `none` option, which equates to an empty string
			if (question.type === 'multiselect' && optionValue === 'none') optionValue = '';

			// validate that there are no conflicts
			let existingOption = official[addonId][questionId];
			if (existingOption !== undefined) {
				if (typeof existingOption === 'boolean') {
					// need to transform the boolean back to `yes` or `no`
					existingOption = existingOption ? 'yes' : 'no';
				}
				throw new Error(
					`Conflicting '${addonId}' option: '${option}' conflicts with '${questionId}:${existingOption}'`
				);
			}

			if (question.type === 'boolean') {
				official[addonId][questionId] = optionValue === 'yes';
			} else if (question.type === 'number') {
				official[addonId][questionId] = Number(optionValue);
			} else {
				official[addonId][questionId] = optionValue;
			}
		}

		// apply defaults to unspecified options
		for (const [id, question] of Object.entries(details.options)) {
			// we'll only apply defaults to options that don't explicitly fail their conditions
			if (question.condition?.(official[addonId]) !== false) {
				official[addonId][id] ??= question.default;
			} else {
				// we'll also error out if a specified option is incompatible with other options.
				// (e.g. `libsql` isn't a valid client for a `mysql` database: `sv add drizzle=database:mysql2,client:libsql`)
				if (official[addonId][id] !== undefined) {
					throw new Error(`Incompatible '${addonId}' option specified: '${official[addonId][id]}'`);
				}
			}
		}
	}

	// we'll let the user choose community addons when `--community` is specified without args
	if (options.community === true) {
		const communityAddons = await Promise.all(
			communityAddonIds.map(async (id) => await getCommunityAddon(id))
		);

		const promptOptions = communityAddons.map((addon) => ({
			value: addon.id,
			label: addon.id,
			hint: 'https://www.npmjs.com/package/' + addon.id
		}));

		const selected = await p.multiselect({
			message: 'Which community tools would you like to add to your project?',
			options: promptOptions,
			required: false
		});

		if (p.isCancel(selected)) {
			p.cancel('Operation cancelled.');
			process.exit(1);
		} else if (selected.length === 0) {
			p.cancel('No add-ons selected. Exiting.');
			process.exit(1);
		}

		options.community = selected;
	}

	// validate and download community addons
	if (Array.isArray(options.community) && options.community.length > 0) {
		// validate addons
		const addons = options.community.map((id) => {
			// ids with directives are passed unmodified so they can be processed during downloads
			const hasDirective = Object.values(Directive).some((directive) => id.startsWith(directive));
			if (hasDirective) return id;

			const validAddon = communityAddonIds.includes(id);
			if (!validAddon) {
				throw new Error(
					`Invalid community add-on specified: '${id}'\nAvailable options: ${communityAddonIds.join(', ')}`
				);
			}
			return id;
		});

		// get addon details from remote addons
		const { start, stop } = p.spinner();
		try {
			start('Resolving community add-on packages');
			const pkgs = await Promise.all(
				addons.map(async (id) => {
					return await getPackageJSON({ cwd: options.cwd, packageName: id });
				})
			);
			stop('Resolved community add-on packages');

			p.log.warn(
				'The Svelte maintainers have not reviewed community add-ons for malicious code. Use at your discretion.'
			);

			const paddingName = common.getPadding(pkgs.map(({ pkg }) => pkg.name));
			const paddingVersion = common.getPadding(pkgs.map(({ pkg }) => `(v${pkg.version})`));

			const packageInfos = pkgs.map(({ pkg, repo: _repo }) => {
				const name = pc.yellowBright(pkg.name.padEnd(paddingName));
				const version = pc.dim(`(v${pkg.version})`.padEnd(paddingVersion));
				const repo = pc.dim(`(${_repo})`);
				return `${name} ${version} ${repo}`;
			});
			p.log.message(packageInfos.join('\n'));

			const confirm = await p.confirm({ message: 'Would you like to continue?' });
			if (confirm !== true) {
				p.cancel('Operation cancelled.');
				process.exit(1);
			}

			start('Downloading community add-on packages');
			const details = await Promise.all(pkgs.map(async (opts) => downloadPackage(opts)));
			for (const addon of details) {
				const id = addon.id;
				community[id] ??= {};
				communityDetails.push(addon);
				selectedAddons.push({ type: 'community', addon });
			}
			stop('Downloaded community add-on packages');
		} catch (err) {
			stop('Failed to resolve community add-on packages', 1);
			throw err;
		}
	}

	// prepare official addons
	let workspace = await createWorkspace({ cwd: options.cwd });

	// prompt which addons to apply
	if (selectedAddons.length === 0) {
		const allSetupResults = setupAddons(officialAddons, workspace);
		const addonOptions = officialAddons
			// only display supported addons relative to the current environment
			.filter(({ id }) => allSetupResults[id].unsupported.length === 0)
			.map(({ id, homepage, shortDescription }) => ({
				label: id,
				value: id,
				hint: `${shortDescription} - ${homepage}`
			}));

		const selected = await p.multiselect({
			message: `What would you like to add to your project? ${pc.dim('(use arrow keys / space bar)')}`,
			options: addonOptions,
			required: false
		});
		if (p.isCancel(selected)) {
			p.cancel('Operation cancelled.');
			process.exit(1);
		}

		for (const id of selected) {
			const addon = officialAddons.find((addon) => addon.id === id)!;
			selectedAddons.push({ type: 'official', addon });
		}
	}

	// add inter-addon dependencies
	for (const { addon } of selectedAddons) {
		workspace = await createWorkspace(workspace);

		const setups = selectedAddons.map(({ addon }) => addon);
		const setupResult = setupAddons(setups, workspace)[addon.id];

		const missingDependencies = setupResult.dependsOn.filter(
			(depId) => !selectedAddons.some((a) => a.addon.id === depId)
		);

		for (const depId of missingDependencies) {
			// TODO: this will have to be adjusted when we work on community add-ons
			const dependency = officialAddons.find((a) => a.id === depId);
			if (!dependency) throw new Error(`'${addon.id}' depends on an invalid add-on: '${depId}'`);

			// prompt to install the dependent
			const install = await p.confirm({
				message: `The ${pc.bold(pc.cyan(addon.id))} add-on requires ${pc.bold(pc.cyan(depId))} to also be setup. ${pc.green('Include it?')}`
			});
			if (install !== true) {
				p.cancel('Operation cancelled.');
				process.exit(1);
			}
			selectedAddons.push({ type: 'official', addon: dependency });
		}
	}

	// run all setups after inter-addon deps have been added
	const addons = selectedAddons.map(({ addon }) => addon);
	const addonSetupResults = setupAddons(addons, workspace);

	// run verifications
	const verifications = [
		...verifyCleanWorkingDirectory(options.cwd, options.gitCheck),
		...verifyUnsupportedAddons(addons, addonSetupResults)
	];

	const fails: Array<{ name: string; message?: string }> = [];
	for (const verification of verifications) {
		const { message, success } = await verification.run();
		if (!success) fails.push({ name: verification.name, message });
	}

	if (fails.length > 0) {
		const message = fails
			.map(({ name, message }) => pc.yellow(`${name} (${message})`))
			.join('\n- ');

		p.note(`- ${message}`, 'Verifications not met', { format: (line) => line });

		const force = await p.confirm({
			message: 'Verifications failed. Do you wish to continue?',
			initialValue: false
		});
		if (p.isCancel(force) || !force) {
			p.cancel('Operation cancelled.');
			process.exit(1);
		}
	}

	// ask remaining questions
	for (const { addon, type } of selectedAddons) {
		const addonId = addon.id;
		const questionPrefix = selectedAddons.length > 1 ? `${addon.id}: ` : '';

		let values: QuestionValues = {};
		if (type === 'official') {
			official[addonId] ??= {};
			values = official[addonId];
		}
		if (type === 'community') {
			community[addonId] ??= {};
			values = community[addonId];
		}

		for (const [questionId, question] of Object.entries(addon.options)) {
			const shouldAsk = question.condition?.(values);
			if (shouldAsk === false || values[questionId] !== undefined) continue;

			let answer;
			const message = questionPrefix + question.question;
			if (question.type === 'boolean') {
				answer = await p.confirm({ message, initialValue: question.default });
			}
			if (question.type === 'select') {
				answer = await p.select({
					message,
					initialValue: question.default,
					options: question.options
				});
			}
			if (question.type === 'multiselect') {
				answer = await p.multiselect({
					message,
					initialValues: question.default,
					required: question.required,
					options: question.options
				});
			}
			if (question.type === 'string' || question.type === 'number') {
				answer = await p.text({
					message,
					initialValue: question.default.toString(),
					placeholder: question.placeholder,
					validate: question.validate
				});
				if (question.type === 'number') {
					answer = Number(answer);
				}
			}
			if (p.isCancel(answer)) {
				p.cancel('Operation cancelled.');
				process.exit(1);
			}

			values[questionId] = answer;
		}
	}

	// we'll return early when no addons are selected,
	// indicating that installing deps was skipped and no PM was selected
	if (selectedAddons.length === 0) return { packageManager: null, nextSteps: [] };

	// apply addons
	const officialDetails = Object.keys(official).map((id) => getAddonDetails(id));
	const commDetails = Object.keys(community).map(
		(id) => communityDetails.find((a) => a.id === id)!
	);
	const details = officialDetails.concat(commDetails);

	const addonMap: AddonMap = Object.assign({}, ...details.map((a) => ({ [a.id]: a })));
	const {
		filesToFormat,
		pnpmBuildDependencies: addonPnpmBuildDependencies,
		installNeeded
	} = await applyAddons({
		workspace,
		addonSetupResults,
		addons: addonMap,
		options: official
	});

	p.log.success('Successfully setup add-ons');

	// prompt for package manager and install dependencies
	let packageManager: PackageManager | undefined;
	if (installNeeded && options.install) {
		packageManager =
			options.install === true ? await packageManagerPrompt(options.cwd) : options.install;

		if (packageManager) {
			workspace.packageManager = packageManager;

			addPnpmBuildDependencies(workspace.cwd, packageManager, [
				'esbuild',
				...addonPnpmBuildDependencies
			]);

			await installDependencies(packageManager, options.cwd);
		}
	}

	// format modified/created files with prettier (if available)
	workspace = await createWorkspace(workspace);
	if (filesToFormat.length > 0 && packageManager && !!workspace.dependencyVersion('prettier')) {
		const { start, stop } = p.spinner();
		start('Formatting modified files');
		try {
			await formatFiles({ packageManager, cwd: options.cwd, paths: filesToFormat });
			stop('Successfully formatted modified files');
		} catch (e) {
			stop('Failed to format files');
			if (e instanceof Error) p.log.error(e.message);
		}
	}

	const highlighter = getHighlighter();

	// print next steps
	const nextSteps = selectedAddons
		.map(({ addon }) => {
			if (!addon.nextSteps) return;
			let addonMessage = `${pc.green(addon.id)}:\n`;

			const options = official[addon.id];
			const addonNextSteps = addon.nextSteps({ ...workspace, options, highlighter });
			addonMessage += `  - ${addonNextSteps.join('\n  - ')}`;
			return addonMessage;
		})
		.filter((msg) => msg !== undefined);

	return { nextSteps, packageManager };
}

/**
 * Dedupes and transforms aliases into their respective addon id
 */
function transformAliases(addons: AddonArgs[]): AddonArgs[] {
	const set = new Map<string, AddonArgs>();

	for (const addon of addons) {
		if (aliases.includes(addon.id)) {
			const officialAddon = officialAddons.find((a) => a.alias === addon.id)!;
			set.set(officialAddon.id, { id: officialAddon.id, options: addon.options });
		} else {
			set.set(addon.id, addon);
		}
	}
	return Array.from(set.values());
}

function getAddonOptionFlags() {
	const options: Array<{ id: string; choices: string; preset: string }> = [];
	for (const addon of officialAddons) {
		const id = addon.id;
		const details = getAddonDetails(id);
		if (Object.values(details.options).length === 0) continue;

		const { defaults, groups } = getOptionChoices(details);
		const choices = Object.entries(groups)
			.map(([group, choices]) => `${pc.dim(`${group}:`)} ${choices.join(', ')}`)
			.join('\n');
		const preset = defaults.join(', ') || 'none';
		options.push({ id, choices, preset });
	}
	return options;
}

function getOptionChoices(details: AddonWithoutExplicitArgs) {
	const choices: string[] = [];
	const defaults: string[] = [];
	const groups: Record<string, string[]> = {};
	const options: OptionValues<any> = {};
	for (const [id, question] of Object.entries(details.options)) {
		let values: string[] = [];
		const applyDefault = question.condition?.(options) !== false;
		if (question.type === 'boolean') {
			values = ['yes', `no`];
			if (applyDefault) {
				options[id] = question.default;
				defaults.push((question.default ? values[0] : values[1])!);
			}
		}
		if (question.type === 'select') {
			values = question.options.map((o) => o.value);
			if (applyDefault) {
				options[id] = question.default;
				defaults.push(question.default);
			}
		}
		if (question.type === 'multiselect') {
			values = question.options.map((o) => o.value);
			if (applyDefault) {
				options[id] = question.default;
				defaults.push(...question.default);
			}
		}
		if (question.type === 'string' || question.type === 'number') {
			values = ['<user-input>'];
			if (applyDefault) {
				options[id] = question.default;
				defaults.push(question.default.toString());
			}
		}

		choices.push(...values);
		// we'll fallback to the question's id
		const groupId = question.group ?? id;
		groups[groupId] ??= [];
		groups[groupId].push(...values);
	}
	return { choices, defaults, groups };
}
