import * as p from '@clack/prompts';
import { Command } from 'commander';
import * as pkg from 'empathic/package';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import pc from 'picocolors';
import * as v from 'valibot';

import {
	officialAddons as _officialAddons,
	getAddonDetails
} from '../../addons/_config/official.ts';
import { type AddonMap, applyAddons, setupAddons } from '../../addons/add.ts';
import type { AddonSetupResult, OptionValues, ResolvedAddon, Workspace } from '../../core.ts';
import { noDownloadCheckOption, noInstallOption } from '../create.ts';
import * as common from '../utils/common.ts';
import {
	AGENT_NAMES,
	addPnpmBuildDependencies,
	installDependencies,
	installOption,
	packageManagerPrompt
} from '../utils/package-manager.ts';
import { downloadPackage, getPackageJSON } from './fetch-packages.ts';
import { formatFiles, style } from './utils.ts';
import { verifyCleanWorkingDirectory, verifyUnsupportedAddons } from './verifiers.ts';
import { createWorkspace } from './workspace.ts';

const officialAddons = Object.values(_officialAddons);
const addonOptions = getAddonOptionFlags();

const OptionsSchema = v.strictObject({
	cwd: v.string(),
	install: v.union([v.boolean(), v.picklist(AGENT_NAMES)]),
	gitCheck: v.boolean(),
	downloadCheck: v.boolean(),
	addons: v.record(v.string(), v.optional(v.array(v.string())))
});
type Options = v.InferOutput<typeof OptionsSchema>;

type AddonArgsIn = { id: string; options?: string[] };
type AddonArgsOut = AddonArgsIn & {
	options: string[];
	kind: 'official' | 'file' | 'scoped';
	resolvedId: string;
};

// infers the workspace cwd if a `package.json` resides in a parent directory
const defaultPkgPath = pkg.up();
const defaultCwd = defaultPkgPath ? path.dirname(defaultPkgPath) : undefined;
export const add = new Command('add')
	.description('applies specified add-ons into a project')
	.argument('[add-on...]', `add-ons to install`, (value: string, previous: AddonArgsOut[] = []) =>
		addonArgsHandler(previous, value)
	)
	.option('-C, --cwd <path>', 'path to working directory', defaultCwd)
	.option('--no-git-check', 'even if some files are dirty, no prompt will be shown')
	.addOption(noDownloadCheckOption)
	.addOption(noInstallOption)
	.addOption(installOption)
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
	.action(async (addonArgs: AddonArgsIn[], opts) => {
		// validate workspace
		if (opts.cwd === undefined) {
			common.errorAndExit(
				'Invalid workspace: Please verify that you are inside of a Svelte project. You can also specify the working directory with `--cwd <path>`'
			);
		} else if (!fs.existsSync(path.resolve(opts.cwd, 'package.json'))) {
			// when `--cwd` is specified, we'll validate that it's a valid workspace
			common.errorAndExit(
				`Invalid workspace: Path '${path.resolve(opts.cwd)}' is not a valid workspace.`
			);
		}

		const options = v.parse(OptionsSchema, { ...opts, addons: {} });
		const selectedAddonArgs = sanitizeAddons(addonArgs);

		const workspace = await createWorkspace({ cwd: options.cwd });

		common.runCommand(async () => {
			// Resolve all addons (official and community) into a unified structure
			const { resolvedAddons, specifierToId } = await resolveAddons(
				selectedAddonArgs,
				options.cwd,
				options.downloadCheck
			);

			// Map options from original specifiers to resolved IDs
			for (const addonArg of selectedAddonArgs) {
				const resolvedId = specifierToId.get(addonArg.id) ?? addonArg.id;
				options.addons[resolvedId] = addonArg.options;
			}

			// Map selectedAddonIds to use resolved IDs
			const selectedAddonIds = selectedAddonArgs.map(({ id }) => {
				return specifierToId.get(id) ?? id;
			});

			const { answers, selectedAddons } = await promptAddonQuestions({
				options,
				selectedAddonIds,
				allAddons: resolvedAddons,
				workspace
			});

			const { nextSteps } = await runAddonsApply({
				answers,
				options,
				selectedAddons,
				workspace,
				fromCommand: 'add'
			});

			if (nextSteps.length > 0) {
				p.note(nextSteps.join('\n'), 'Next steps', { format: (line) => line });
			}
		});
	});

/**
 * Resolves all addons (official and community) into a unified structure.
 * Returns a map of resolved addons keyed by their resolved ID.
 */
export async function resolveAddons(
	addonArgs: AddonArgsOut[],
	cwd: string,
	downloadCheck: boolean
): Promise<{
	resolvedAddons: Map<string, ResolvedAddon>;
	specifierToId: Map<string, string>;
}> {
	const resolvedAddons = new Map<string, ResolvedAddon>();
	const specifierToId = new Map<string, string>();

	// Separate official and community addons for resolution
	const officialAddonArgs = addonArgs.filter((addon) => addon.kind === 'official');
	const communityAddonArgs = addonArgs.filter((addon) => addon.kind !== 'official');

	// Resolve official addons
	for (const addonArg of officialAddonArgs) {
		const addon = getAddonDetails(addonArg.id);
		// Official addons don't need originalSpecifier since they're referenced by ID
		resolvedAddons.set(addon.id, addon);
		specifierToId.set(addonArg.id, addon.id);
	}

	// Resolve community addons (file: and scoped packages)
	if (communityAddonArgs.length > 0) {
		const communitySpecifiers = communityAddonArgs.map((addon) => addon.id);
		const communityAddons = await resolveNonOfficialAddons(cwd, communityAddonArgs, downloadCheck);

		// Map community addons by position (they're resolved in the same order)
		communitySpecifiers.forEach((specifier, index) => {
			const resolvedAddon = communityAddons[index];
			if (resolvedAddon) {
				// Store the original specifier directly on the addon
				resolvedAddon.originalSpecifier = specifier;
				resolvedAddons.set(resolvedAddon.id, resolvedAddon);
				specifierToId.set(specifier, resolvedAddon.id);
			}
		});
	}

	return { resolvedAddons, specifierToId };
}

export async function promptAddonQuestions({
	options,
	selectedAddonIds,
	allAddons,
	workspace
}: {
	options: Options;
	selectedAddonIds: string[];
	allAddons: Map<string, ResolvedAddon>;
	workspace: Workspace;
}) {
	const selectedAddons: ResolvedAddon[] = [];

	// Find addons by ID using unified lookup
	for (const id of selectedAddonIds) {
		const addon = allAddons.get(id);
		if (addon) {
			selectedAddons.push(addon);
		}
	}

	const emptyAnswersReducer = (acc: Record<string, OptionValues<any>>, id: string) => {
		acc[id] = {};
		return acc;
	};

	const answers: Record<string, OptionValues<any>> = selectedAddons
		.map(({ id }) => id)
		.reduce(emptyAnswersReducer, {});

	// apply specified options from CLI, inquire about the rest
	for (const addonId of Object.keys(options.addons)) {
		const specifiedOptions = options.addons[addonId];
		if (!specifiedOptions) continue;

		// Get addon details using unified lookup
		const details = allAddons.get(addonId);

		if (!details) continue;

		if (!selectedAddons.find((d) => d.id === details.id)) {
			selectedAddons.push(details);
		}

		answers[addonId] ??= {};

		const optionEntries = Object.entries(details.options);
		const specifiedOptionsObject = Object.fromEntries(
			specifiedOptions.map((option) => option.split(':', 2))
		);
		// Only process CLI options if any were actually specified
		if (specifiedOptions.length > 0) {
			for (const option of specifiedOptions) {
				const [optionId, optionValue] = option.split(':', 2);

				// validates that the option exists
				const optionEntry = optionEntries.find(([id, question]) => {
					// simple ID match
					if (id === optionId) return true;

					// group match - need to check conditions and value validity
					if (question.group === optionId) {
						// does the value exist for this option?
						if (question.type === 'select') {
							const isValidValue = question.options.some((opt) => opt.value === optionValue);
							if (!isValidValue) return false;
						} else if (question.type === 'multiselect') {
							// For multiselect, split by comma and validate each value
							const values = optionValue === 'none' ? [] : optionValue.split(',');
							const isValidValue = values.every((val) =>
								question.options.some((opt) => opt.value === val.trim())
							);
							if (!isValidValue) return false;
						}

						// if there's a condition, does it pass?
						if (question.condition) {
							return question.condition(specifiedOptionsObject);
						}

						// finally, unconditional
						return true;
					}

					// unrecognized optionId
					return false;
				});

				if (!optionEntry) {
					const { choices } = getOptionChoices(details);
					common.errorAndExit(
						`Invalid '${addonId}' add-on option: '${option}'\nAvailable options: ${choices.join(', ')}`
					);
					throw new Error();
				}

				const [questionId, question] = optionEntry;

				// Validate multiselect values for simple ID matches (already validated for group matches above)
				if (question.type === 'multiselect' && questionId === optionId) {
					const values = optionValue === 'none' || optionValue === '' ? [] : optionValue.split(',');
					const invalidValues = values.filter(
						(val) => !question.options.some((opt) => opt.value === val.trim())
					);
					if (invalidValues.length > 0) {
						const validValues = question.options.map((opt) => opt.value).join(', ');
						common.errorAndExit(
							`Invalid '${addonId}' add-on option: '${option}'\nInvalid values: ${invalidValues.join(', ')}\nAvailable values: ${validValues}`
						);
					}
				}

				// validate that there are no conflicts
				let existingOption = answers[addonId][questionId];
				if (existingOption !== undefined) {
					if (typeof existingOption === 'boolean') {
						// need to transform the boolean back to `yes` or `no`
						existingOption = existingOption ? 'yes' : 'no';
					}
					common.errorAndExit(
						`Conflicting '${addonId}' option: '${option}' conflicts with '${questionId}:${existingOption}'`
					);
				}

				if (question.type === 'boolean') {
					answers[addonId][questionId] = optionValue === 'yes';
				} else if (question.type === 'number') {
					answers[addonId][questionId] = Number(optionValue);
				} else if (question.type === 'multiselect') {
					// multiselect options can be specified with a `none` option, which equates to an empty array
					if (optionValue === 'none' || optionValue === '') {
						answers[addonId][questionId] = [];
					} else {
						// split by comma and trim each value
						answers[addonId][questionId] = optionValue.split(',').map((v) => v.trim());
					}
				} else {
					answers[addonId][questionId] = optionValue;
				}
			}

			// apply defaults to unspecified options (only if CLI options were specified)
			for (const [id, question] of Object.entries(details.options)) {
				// we'll only apply defaults to options that don't explicitly fail their conditions
				if (question.condition?.(answers[addonId]) !== false) {
					answers[addonId][id] ??= question.default;
				} else {
					// we'll also error out if a specified option is incompatible with other options.
					// (e.g. `libsql` isn't a valid client for a `mysql` database: `sv add drizzle=database:mysql2,client:libsql`)
					if (answers[addonId][id] !== undefined) {
						throw new Error(
							`Incompatible '${addonId}' option specified: '${answers[addonId][id]}'`
						);
					}
				}
			}
		}
	}

	// Process all selected addons (including those without CLI options) to ensure they're initialized
	// Note: We don't apply defaults here - defaults will be used as initial values when asking questions
	for (const addon of selectedAddons) {
		const addonId = addon.id;
		answers[addonId] ??= {};
	}

	// run setup if we have access to workspace
	// prepare addons (both official and non-official)
	let addonSetupResults: Record<string, AddonSetupResult> = {};

	// If we have selected addons, run setup on them (regardless of official status)
	if (selectedAddons.length > 0) {
		addonSetupResults = setupAddons(selectedAddons, workspace);
	}

	// prompt which addons to apply (only when no addons were specified)
	// Only show selection prompt if no addons were specified at all
	if (selectedAddonIds.length === 0) {
		// For the prompt, we only show official addons
		const officialAddonsList = Array.from(allAddons.values()).filter((addon) =>
			officialAddons.some((o) => o.id === addon.id)
		);
		const allSetupResults = setupAddons(officialAddonsList, workspace);
		const addonOptions = officialAddonsList
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
			const addon = allAddons.get(id);
			if (addon) {
				selectedAddons.push(addon);
				answers[id] = {};
			}
		}

		// Re-run setup for all selected addons (including any that were added via CLI options)
		addonSetupResults = setupAddons(selectedAddons, workspace);
	}

	// Ensure all selected addons have setup results
	// This should always be the case, but we add a safeguard
	const missingSetupResults = selectedAddons.filter((addon) => !addonSetupResults[addon.id]);
	if (missingSetupResults.length > 0) {
		const additionalSetupResults = setupAddons(missingSetupResults, workspace);
		Object.assign(addonSetupResults, additionalSetupResults);
	}

	// add inter-addon dependencies
	// We need to iterate until no new dependencies are added (to handle transitive dependencies)
	let hasNewDependencies = true;
	while (hasNewDependencies) {
		hasNewDependencies = false;
		const addonsToProcess = [...selectedAddons]; // Work with a snapshot to avoid infinite loops

		for (const addon of addonsToProcess) {
			const setupResult = addonSetupResults[addon.id];
			if (!setupResult) {
				common.errorAndExit(`Setup result missing for addon: ${addon.id}`);
			}
			const missingDependencies = setupResult.dependsOn.filter(
				(depId) => !selectedAddons.some((a) => a.id === depId)
			);

			for (const depId of missingDependencies) {
				hasNewDependencies = true;
				// Dependencies are always official addons
				const depAddon = allAddons.get(depId);
				if (!depAddon) {
					// If not in resolved addons, try to get it (dependencies are always official)
					const officialDep = officialAddons.find((a) => a.id === depId);
					if (!officialDep) {
						throw new Error(`'${addon.id}' depends on an invalid add-on: '${depId}'`);
					}
					// Add official dependency to the map and use it
					const officialAddonDetails = getAddonDetails(depId);
					allAddons.set(depId, officialAddonDetails);
					selectedAddons.push(officialAddonDetails);
					answers[depId] = {};
					continue;
				}

				// prompt to install the dependent
				const install = await p.confirm({
					message: `The ${pc.bold(pc.cyan(addon.id))} add-on requires ${pc.bold(pc.cyan(depId))} to also be setup. ${pc.green('Include it?')}`
				});
				if (install !== true) {
					p.cancel('Operation cancelled.');
					process.exit(1);
				}
				selectedAddons.push(depAddon);
				answers[depId] = {};
			}
		}

		// Run setup for any newly added dependencies
		const newlyAddedAddons = selectedAddons.filter((addon) => !addonSetupResults[addon.id]);
		if (newlyAddedAddons.length > 0) {
			const newSetupResults = setupAddons(newlyAddedAddons, workspace);
			Object.assign(addonSetupResults, newSetupResults);
		}
	}

	// run all setups after inter-addon deps have been added
	const addons = selectedAddons;
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
	for (const addon of selectedAddons) {
		const addonId = addon.id;
		const questionPrefix = selectedAddons.length > 1 ? `${addon.id}: ` : '';

		answers[addonId] ??= {};
		const values = answers[addonId];

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
					initialValue: question.default?.toString() ?? (question.type === 'number' ? '0' : ''),
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

	return { selectedAddons, answers };
}

export async function runAddonsApply({
	answers,
	options,
	selectedAddons,
	addonSetupResults,
	workspace,
	fromCommand
}: {
	answers: Record<string, OptionValues<any>>;
	options: Options;
	selectedAddons: ResolvedAddon[];
	addonSetupResults?: Record<string, AddonSetupResult>;
	workspace: Workspace;
	fromCommand: 'create' | 'add';
}): Promise<{ nextSteps: string[]; argsFormattedAddons: string[]; filesToFormat: string[] }> {
	if (!addonSetupResults) {
		// When no addons are selected, use official addons for setup
		const officialAddonsList = officialAddons;
		const setups = selectedAddons.length ? selectedAddons : officialAddonsList;
		addonSetupResults = setupAddons(setups, workspace);
	}
	// we'll return early when no addons are selected,
	// indicating that installing deps was skipped and no PM was selected
	if (selectedAddons.length === 0)
		return { nextSteps: [], argsFormattedAddons: [], filesToFormat: [] };

	// apply addons
	const addonMap: AddonMap = Object.assign({}, ...selectedAddons.map((a) => ({ [a.id]: a })));
	const { filesToFormat, pnpmBuildDependencies, status } = await applyAddons({
		workspace,
		addonSetupResults,
		addons: addonMap,
		options: answers
	});

	const addonSuccess: string[] = [];
	for (const [addonId, info] of Object.entries(status)) {
		if (info === 'success') addonSuccess.push(addonId);
		else {
			p.log.warn(`Canceled ${addonId}: ${info.join(', ')}`);
			selectedAddons = selectedAddons.filter((a) => a.id !== addonId);
		}
	}

	if (addonSuccess.length === 0) {
		p.cancel('All selected add-ons were canceled.');
		process.exit(1);
	} else {
		p.log.success(
			`Successfully setup add-ons: ${addonSuccess.map((c) => style.addon(c)).join(', ')}`
		);
	}

	const packageManager =
		options.install === false
			? null
			: options.install === true
				? await packageManagerPrompt(options.cwd)
				: options.install;

	await addPnpmBuildDependencies(workspace.cwd, packageManager, [
		'esbuild',
		...pnpmBuildDependencies
	]);

	const argsFormattedAddons: string[] = [];
	for (const addon of selectedAddons) {
		const addonId = addon.id;
		const addonAnswers = answers[addonId];
		if (!addonAnswers) continue;

		// Use original specifier if available, otherwise fall back to resolved ID
		const addonSpecifier = addon.originalSpecifier ?? addonId;

		const optionParts: string[] = [];

		for (const [optionId, value] of Object.entries(addonAnswers)) {
			if (value === undefined) continue;

			const question = addon.options[optionId];
			if (!question) continue;

			let formattedValue: string;
			if (question.type === 'boolean') {
				formattedValue = value ? 'yes' : 'no';
			} else if (question.type === 'number') {
				formattedValue = String(value);
			} else if (question.type === 'multiselect') {
				if (Array.isArray(value)) {
					if (value.length === 0) {
						formattedValue = 'none';
					} else {
						formattedValue = value.join(',');
					}
				} else {
					formattedValue = String(value);
				}
			} else {
				formattedValue = String(value);
			}

			optionParts.push(`${optionId}:${formattedValue}`);
		}

		if (optionParts.length > 0) {
			argsFormattedAddons.push(`${addonSpecifier}="${optionParts.join('+')}"`);
		} else {
			argsFormattedAddons.push(addonSpecifier);
		}
	}

	if (!options.downloadCheck) argsFormattedAddons.push('--no-download-check');
	if (!options.gitCheck) argsFormattedAddons.push('--no-git-check');

	if (fromCommand === 'add') common.logArgs(packageManager, 'add', argsFormattedAddons);

	if (packageManager) {
		workspace.packageManager = packageManager;
		await installDependencies(packageManager, options.cwd);
		await formatFiles({ packageManager, cwd: options.cwd, filesToFormat });
	}

	// print next steps
	const nextSteps = selectedAddons
		.map((addon) => {
			if (!addon.nextSteps) return;
			const addonOptions = answers[addon.id];
			const addonNextSteps = addon.nextSteps({ ...workspace, options: addonOptions });
			if (addonNextSteps.length === 0) return;

			let addonMessage = `${pc.green(addon.id)}:\n`;
			addonMessage += `  - ${addonNextSteps.join('\n  - ')}`;
			return addonMessage;
		})
		.filter((msg) => msg !== undefined);

	return { nextSteps, argsFormattedAddons, filesToFormat };
}

export function sanitizeAddons(addonArgs: AddonArgsIn[]): AddonArgsOut[] {
	const toRet = new Map<string, AddonArgsOut>();

	const invalidAddons: string[] = [];
	for (const addon of addonArgs) {
		const official = officialAddons.find((a) => a.id === addon.id || a.alias === addon.id);
		if (official) {
			toRet.set(official.id, {
				id: official.id,
				options: addon.options ?? [],
				kind: 'official',
				resolvedId: official.id
			});
		} else if (addon.id.startsWith('file:')) {
			const resolvedId = addon.id.replace('file:', '').trim();
			if (!resolvedId) {
				invalidAddons.push('file:');
				continue;
			}
			toRet.set(addon.id, {
				id: addon.id,
				options: addon.options ?? [],
				kind: 'file',
				resolvedId
			});
		} else if (addon.id.startsWith('@')) {
			// Scoped package (e.g., @org/name)
			const resolvedId = addon.id.includes('/') ? addon.id : addon.id + '/sv';
			toRet.set(addon.id, {
				id: addon.id,
				options: addon.options ?? [],
				kind: 'scoped',
				resolvedId
			});
		} else {
			invalidAddons.push(addon.id);
		}
	}
	if (invalidAddons.length > 0) {
		common.errorAndExit(
			`Invalid add-ons specified: ${invalidAddons.map((id) => style.command(id)).join(', ')}\n` +
				`${style.optional('Check the documentation for valid add-on specifiers:')} ${style.website('https://svelte.dev/docs/cli/sv-add')}`
		);
	}

	return Array.from(toRet.values());
}

/**
 * Handles passed add-on arguments, accumulating them into an array of {@link AddonArgs}.
 */
export function addonArgsHandler(acc: AddonArgsIn[], current: string): AddonArgsIn[] {
	const [addonId, optionFlags] = current.split('=', 2);

	// validates that there are no repeated add-ons (e.g. `sv add foo=demo:yes foo=demo:no`)
	const repeatedAddons = acc.find(({ id }) => id === addonId);
	if (repeatedAddons) {
		common.errorAndExit(`Malformed arguments: Add-on '${addonId}' is repeated multiple times.`);
	}

	try {
		const options = common.parseAddonOptions(optionFlags);
		acc.push({ id: addonId, options });
	} catch (error) {
		if (error instanceof Error) {
			common.errorAndExit(error.message);
		}
		console.error(error);
		process.exit(1);
	}

	return acc;
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

function getOptionChoices(details: ResolvedAddon) {
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
			if (applyDefault && question.default !== undefined) {
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

export async function resolveNonOfficialAddons(
	cwd: string,
	addons: AddonArgsOut[],
	downloadCheck: boolean
) {
	const selectedAddons: ResolvedAddon[] = [];
	const { start, stop } = p.spinner();

	try {
		start(`Resolving ${addons.map((a) => style.addon(a.id)).join(', ')} packages`);

		const pkgs = await Promise.all(
			addons.map(async (a) => {
				return await getPackageJSON({ cwd, packageName: a.id });
			})
		);
		stop('Resolved community add-on packages');

		p.log.warn(
			'Svelte maintainers have not reviewed community add-ons for malicious code. Use at your discretion.'
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

		if (downloadCheck) {
			const confirm = await p.confirm({ message: 'Would you like to continue?' });
			if (confirm !== true) {
				p.cancel('Operation cancelled.');
				process.exit(1);
			}
		}

		start('Downloading community add-on packages');
		const details = await Promise.all(pkgs.map(async (opts) => downloadPackage(opts)));
		for (const addon of details) {
			selectedAddons.push(addon);
		}
		stop('Downloaded community add-on packages');
	} catch (err) {
		const msg = err instanceof Error ? err.message : 'Unknown error';
		common.errorAndExit(
			`Failed to resolve ${addons.map((a) => style.addon(a.id)).join(', ')}\n${style.optional(msg)}`
		);
	}
	return selectedAddons;
}
