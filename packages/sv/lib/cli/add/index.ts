import * as p from '@clack/prompts';
import { Command } from 'commander';
import * as pkg from 'empathic/package';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import * as v from 'valibot';

import {
	officialAddons as _officialAddons,
	getAddonDetails
} from '../../addons/_engine/official.ts';
import { applyAddons, setupAddons } from '../../addons/_engine/add.ts';
import type {
	AddonDefinition,
	AddonInput,
	AddonReference,
	AddonSource,
	LoadedAddon,
	OptionValues,
	SetupResult,
	Workspace
} from '../../core.ts';
import { getErrorHint } from '../../coreInternal.ts';
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
import { formatFiles, color } from './utils.ts';
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

/**
 * Classifies addon inputs into AddonReferences with source information.
 */
export function classifyAddons(inputs: AddonInput[], cwd: string): AddonReference[] {
	const seen = new Map<string, AddonReference>();
	const invalidAddons: string[] = [];

	for (const input of inputs) {
		const official = officialAddons.find(
			(a) => a.id === input.specifier || a.alias === input.specifier
		);

		if (official) {
			const source: AddonSource = { kind: 'official', id: official.id };
			seen.set(official.id, {
				specifier: input.specifier,
				options: input.options,
				source
			});
		} else if (input.specifier.startsWith('file:')) {
			const relativePath = input.specifier.slice(5).trim();
			if (!relativePath) {
				invalidAddons.push('file:');
				continue;
			}
			const filePath = path.resolve(cwd, relativePath);
			const source: AddonSource = { kind: 'file', path: filePath };
			seen.set(input.specifier, {
				specifier: input.specifier,
				options: input.options,
				source
			});
		} else {
			// npm package - normalize and extract name/tag
			const normalized = input.specifier.startsWith('@')
				? input.specifier.includes('/')
					? input.specifier
					: input.specifier + '/sv'
				: input.specifier;

			// Split name and tag: @scope/name@version or name@version
			let packageName: string;
			let tag: string;
			if (normalized.startsWith('@')) {
				// Scoped: @scope/name or @scope/name@version
				const slashIndex = normalized.indexOf('/');
				const afterSlash = normalized.slice(slashIndex + 1);
				const [name, version = 'latest'] = afterSlash.split('@');
				packageName = normalized.slice(0, slashIndex + 1) + name;
				tag = version;
			} else {
				// Unscoped: name or name@version
				const [name, version = 'latest'] = normalized.split('@');
				packageName = name;
				tag = version;
			}

			const npmUrl = `https://www.npmjs.com/package/${packageName}`;
			const registryUrl = `https://registry.npmjs.org/${packageName}/${tag}`;
			const source: AddonSource = { kind: 'npm', packageName, tag, npmUrl, registryUrl };
			seen.set(input.specifier, {
				specifier: input.specifier,
				options: input.options,
				source
			});
		}
	}

	if (invalidAddons.length > 0) {
		common.errorAndExit(
			`Invalid add-ons specified: ${invalidAddons.map((id) => color.command(id)).join(', ')}\n` +
				`${color.optional('Check the documentation for valid add-on specifiers:')} ${color.website('https://svelte.dev/docs/cli/sv-add')}`
		);
	}

	return Array.from(seen.values());
}

/**
 * Creates a LoadedAddon from an AddonDefinition (for official addons)
 */
export function createLoadedAddon(addon: AddonDefinition): LoadedAddon {
	return {
		reference: {
			specifier: addon.id,
			options: [],
			source: { kind: 'official', id: addon.id }
		},
		addon
	};
}

// infers the workspace cwd if a `package.json` resides in a parent directory
const defaultPkgPath = pkg.up();
const defaultCwd = defaultPkgPath ? path.dirname(defaultPkgPath) : undefined;
export const add = new Command('add')
	.description('applies specified add-ons into a project')
	.argument('[add-on...]', `add-ons to install`, (value: string, previous: AddonInput[] = []) =>
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
	.action(async (addonInputs: AddonInput[], opts) => {
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
		const addonRefs = classifyAddons(addonInputs, options.cwd);

		const workspace = await createWorkspace({ cwd: options.cwd });

		common.runCommand(async () => {
			// Resolve all addons (official and community) - returns LoadedAddon[]
			const loadedAddons = await resolveAddons(addonRefs, options.downloadCheck);

			// Map options from refs to resolved IDs
			for (const loaded of loadedAddons) {
				const id = loaded.addon.id;
				options.addons[id] = loaded.reference.options;
			}

			const { answers, loadedAddons: finalAddons } = await promptAddonQuestions({
				options,
				loadedAddons,
				workspace
			});

			const { nextSteps } = await runAddonsApply({
				answers,
				options,
				loadedAddons: finalAddons,
				workspace,
				fromCommand: 'add'
			});

			if (nextSteps.length > 0) {
				p.note(nextSteps.join('\n'), 'Next steps', { format: (line) => line });
			}
		});
	});

/**
 * Resolves all addons (official and community).
 * Returns LoadedAddon[] with addon code loaded.
 */
export async function resolveAddons(
	refs: AddonReference[],
	downloadCheck: boolean
): Promise<LoadedAddon[]> {
	const loaded: LoadedAddon[] = [];

	// Separate official and community addons for resolution
	const officialRefs = refs.filter((ref) => ref.source.kind === 'official');
	const communityRefs = refs.filter((ref) => ref.source.kind !== 'official');

	// Resolve official addons
	for (const ref of officialRefs) {
		if (ref.source.kind !== 'official') continue;
		const addon = getAddonDetails(ref.source.id);
		loaded.push({
			reference: ref,
			addon
		});
	}

	// Resolve community addons (file: and npm packages)
	if (communityRefs.length > 0) {
		const communityAddons = await resolveNonOfficialAddons(communityRefs, downloadCheck);

		// Create LoadedAddon for each resolved community addon
		communityRefs.forEach((ref, index) => {
			const resolvedAddon = communityAddons[index];
			if (resolvedAddon) {
				loaded.push({
					reference: ref,
					addon: resolvedAddon
				});
			}
		});
	}

	return loaded;
}

export async function promptAddonQuestions({
	options,
	loadedAddons,
	workspace
}: {
	options: Options;
	loadedAddons: LoadedAddon[];
	workspace: Workspace;
}) {
	// Work with a mutable copy of loaded addons
	const addons = [...loadedAddons];

	const emptyAnswersReducer = (acc: Record<string, OptionValues<any>>, id: string) => {
		acc[id] = {};
		return acc;
	};

	const answers: Record<string, OptionValues<any>> = addons
		.map((a) => a.addon.id)
		.reduce(emptyAnswersReducer, {});

	// apply specified options from CLI, inquire about the rest
	for (const addonId of Object.keys(options.addons)) {
		const specifiedOptions = options.addons[addonId];
		if (!specifiedOptions) continue;

		// Get addon details from loaded addon
		const loaded = addons.find((a) => a.addon.id === addonId);
		const details = loaded?.addon;

		if (!details) continue;

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

			// Validate incompatible options (only if CLI options were specified)
			// Note: We don't apply defaults here - all unanswered options will be asked later,
			// and defaults will be used as initial values when prompting
			// if you want to skip the prompt, add it in the args! (will be shown before nextSteps)
			for (const [id, question] of Object.entries(details.options)) {
				// Check condition: if it returns false, the option should not be asked and value should be undefined
				const conditionResult = question.condition?.(answers[addonId]);
				if (conditionResult === false) {
					// Condition says don't ask - value should remain undefined
					// Error out if a specified option is incompatible with other options.
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
	for (const loaded of addons) {
		answers[loaded.addon.id] ??= {};
	}

	// run setup if we have access to workspace
	// prepare addons (both official and non-official)
	let setupResults: Record<string, SetupResult> = {};

	// If we have selected addons, run setup on them (regardless of official status)
	if (addons.length > 0) {
		setupResults = setupAddons(addons, workspace);
	}

	// prompt which addons to apply (only when no addons were specified)
	// Only show selection prompt if no addons were specified at all
	if (addons.length === 0) {
		// For the prompt, we only show official addons
		const officialLoaded = officialAddons.map((a) => createLoadedAddon(a));
		const results = setupAddons(officialLoaded, workspace);
		const addonOptions = officialAddons
			// only display supported addons relative to the current environment
			.filter(({ id, hidden }) => results[id].unsupported.length === 0 && !hidden)
			.map(({ id, homepage, shortDescription }) => ({
				label: id,
				value: id,
				hint: `${shortDescription} - ${homepage}`
			}));

		const selected = await p.multiselect({
			message: `What would you like to add to your project? ${color.dim('(use arrow keys / space bar)')}`,
			options: addonOptions,
			required: false
		});
		if (p.isCancel(selected)) {
			p.cancel('Operation cancelled.');
			process.exit(1);
		}

		for (const id of selected) {
			// Create LoadedAddon for newly selected official addon
			const addon = getAddonDetails(id);
			addons.push(createLoadedAddon(addon));
			answers[id] = {};
		}

		// Re-run setup for all selected addons (including any that were added via CLI options)
		setupResults = setupAddons(addons, workspace);
	}

	// Ensure all selected addons have setup results
	// This should always be the case, but we add a safeguard
	const missingSetupResults = addons.filter((a) => !setupResults[a.addon.id]);
	if (missingSetupResults.length > 0) {
		const additionalSetupResults = setupAddons(missingSetupResults, workspace);
		Object.assign(setupResults, additionalSetupResults);
	}

	// add inter-addon dependencies
	// We need to iterate until no new dependencies are added (to handle transitive dependencies)
	// Track dependency chains to detect circular dependencies
	const dependencyChains = new Map<string, Set<string>>();

	let hasNewDependencies = true;
	while (hasNewDependencies) {
		hasNewDependencies = false;
		const addonsToProcess = [...addons]; // Work with a snapshot to avoid infinite loops

		for (const loaded of addonsToProcess) {
			const addonId = loaded.addon.id;
			const setupResult = setupResults[addonId];
			if (!setupResult) {
				common.errorAndExit(`Setup result missing for addon: ${addonId}`);
			}
			const missingDependencies = setupResult.dependsOn.filter(
				(depId) => !addons.some((a) => a.addon.id === depId)
			);

			for (const depId of missingDependencies) {
				// Check for circular dependencies
				const addonChain = dependencyChains.get(addonId) ?? new Set();
				if (addonChain.has(depId)) {
					// Build the cycle path for a helpful error message
					const cyclePath = [...addonChain, addonId, depId].join(' → ');
					common.errorAndExit(
						`Circular dependency detected: ${cyclePath}\n` +
							`Add-ons cannot have circular dependencies.`
					);
				}

				// Track the dependency chain
				const depChain = new Set(addonChain);
				depChain.add(addonId);
				dependencyChains.set(depId, depChain);

				hasNewDependencies = true;
				// Dependencies are always official addons - check if already in addons
				const existingLoaded = addons.find((a) => a.addon.id === depId);
				if (!existingLoaded) {
					// Not in addons, get from official addons
					const officialDep = officialAddons.find((a) => a.id === depId);
					if (!officialDep) {
						throw new Error(`'${addonId}' depends on an invalid add-on: '${depId}'`);
					}
					// Add official dependency as new LoadedAddon
					const officialAddonDetails = getAddonDetails(depId);
					addons.push(createLoadedAddon(officialAddonDetails));
					answers[depId] = {};
					continue;
				}

				// prompt to install the dependent
				const install = await p.confirm({
					message: `The ${color.addon(addonId)} add-on requires ${color.addon(depId)} to also be setup. ${color.success('Include it?')}`
				});
				if (install !== true) {
					p.cancel('Operation cancelled.');
					process.exit(1);
				}
				// Already exists in addons, just add to answers
				answers[depId] = {};
			}
		}

		// Run setup for any newly added dependencies
		const newlyAddedAddons = addons.filter((a) => !setupResults[a.addon.id]);
		if (newlyAddedAddons.length > 0) {
			const newSetupResults = setupAddons(newlyAddedAddons, workspace);
			Object.assign(setupResults, newSetupResults);
		}
	}

	// run verifications after inter-addon deps have been added
	const addonDefinitions = addons.map((a) => a.addon);
	const verifications = [
		...verifyCleanWorkingDirectory(options.cwd, options.gitCheck),
		...verifyUnsupportedAddons(addonDefinitions, setupResults)
	];

	const fails: Array<{ name: string; message?: string }> = [];
	for (const verification of verifications) {
		const { message, success } = await verification.run();
		if (!success) fails.push({ name: verification.name, message });
	}

	if (fails.length > 0) {
		const message = fails
			.map(({ name, message }) => color.warning(`${name} (${message})`))
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
	for (const loaded of addons) {
		const addon = loaded.addon;
		const addonId = addon.id;
		const questionPrefix = addons.length > 1 ? `${addonId}: ` : '';

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

	return { loadedAddons: addons, answers };
}

export async function runAddonsApply({
	answers,
	options,
	loadedAddons,
	setupResults,
	workspace,
	fromCommand
}: {
	answers: Record<string, OptionValues<any>>;
	options: Options;
	loadedAddons: LoadedAddon[];
	setupResults?: Record<string, SetupResult>;
	workspace: Workspace;
	fromCommand: 'create' | 'add';
}): Promise<{ nextSteps: string[]; argsFormattedAddons: string[]; filesToFormat: string[] }> {
	if (!setupResults) {
		// When no addons are selected, use official addons for setup
		const setups = loadedAddons.length
			? loadedAddons
			: officialAddons.map((a) => createLoadedAddon(a));
		setupResults = setupAddons(setups, workspace);
	}
	// we'll return early when no addons are selected,
	// indicating that installing deps was skipped and no PM was selected
	if (loadedAddons.length === 0)
		return { nextSteps: [], argsFormattedAddons: [], filesToFormat: [] };

	const { filesToFormat, pnpmBuildDependencies, status } = await applyAddons({
		loadedAddons,
		workspace,
		setupResults,
		options: answers
	});

	const addonSuccess: string[] = [];
	const canceledAddonIds: string[] = [];
	for (const [addonId, info] of Object.entries(status)) {
		if (info === 'success') addonSuccess.push(addonId);
		else {
			p.log.warn(`Canceled ${addonId}: ${info.join(', ')}`);
			canceledAddonIds.push(addonId);
		}
	}
	// Filter out canceled addons
	const successfulAddons = loadedAddons.filter((a) => !canceledAddonIds.includes(a.addon.id));

	if (addonSuccess.length === 0) {
		p.cancel('All selected add-ons were canceled.');
		process.exit(1);
	} else {
		p.log.success(
			`Successfully setup add-ons: ${addonSuccess.map((c) => color.addon(c)).join(', ')}`
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
	for (const loaded of successfulAddons) {
		const addonId = loaded.addon.id;
		const addon = loaded.addon;
		const addonAnswers = answers[addonId];
		if (!addonAnswers) continue;

		const addonSpecifier = loaded.reference.specifier;

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

	if (fromCommand === 'add') {
		if (!options.gitCheck) argsFormattedAddons.push('--no-git-check');

		common.buildAndLogArgs(packageManager, 'add', argsFormattedAddons);
	}

	if (packageManager) {
		workspace.packageManager = packageManager;
		await installDependencies(packageManager, options.cwd);
		await formatFiles({ packageManager, cwd: options.cwd, filesToFormat });
	}

	// print next steps
	const nextSteps = successfulAddons
		.map((loaded) => {
			const addon = loaded.addon;
			if (!addon.nextSteps) return;
			const addonOptions = answers[addon.id];
			const addonNextSteps = addon.nextSteps({ ...workspace, options: addonOptions });
			if (addonNextSteps.length === 0) return;

			let addonMessage = `${color.addon(addon.id)}:\n`;
			addonMessage += `  - ${addonNextSteps.join('\n  - ')}`;
			return addonMessage;
		})
		.filter((msg): msg is string => msg !== undefined);

	return { nextSteps, argsFormattedAddons, filesToFormat };
}

/**
 * Handles passed add-on arguments, accumulating them into an array of AddonInput.
 */
export function addonArgsHandler(acc: AddonInput[], current: string): AddonInput[] {
	const [addonSpecifier, optionFlags] = current.split('=', 2);

	// validates that there are no repeated add-ons (e.g. `sv add foo=demo:yes foo=demo:no`)
	const repeatedAddons = acc.find(({ specifier }) => specifier === addonSpecifier);
	if (repeatedAddons) {
		common.errorAndExit(
			`Malformed arguments: Add-on '${addonSpecifier}' is repeated multiple times.`
		);
	}

	try {
		const options = common.parseAddonOptions(optionFlags);
		acc.push({ specifier: addonSpecifier, options: options ?? [] });
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
			.map(([group, choices]) => `${color.optional(`${group}:`)} ${color.dim(choices.join(', '))}`)
			.join('\n');
		const preset = defaults.join(', ') || 'none';
		options.push({ id, choices, preset });
	}
	return options;
}

function getOptionChoices(details: AddonDefinition) {
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
	refs: AddonReference[],
	downloadCheck: boolean
): Promise<AddonDefinition[]> {
	const selectedAddons: AddonDefinition[] = [];
	const { start, stop } = p.spinner();

	try {
		start(`Resolving ${refs.map((r) => color.addon(r.specifier)).join(', ')} packages`);

		const pkgs = await Promise.all(
			refs.map(async (ref) => {
				if (ref.source.kind === 'official') {
					throw new Error(`Unexpected official addon in non-official resolver: ${ref.specifier}`);
				}
				return await getPackageJSON(ref);
			})
		);
		stop('Resolved community add-on packages');

		// Display version compatibility warnings
		for (const { warning } of pkgs) {
			if (warning) {
				p.log.warn(warning);
			}
		}

		p.log.warn(
			'Svelte maintainers have not reviewed community add-ons for malicious code. Use at your discretion.'
		);

		const paddingName = common.getPadding(pkgs.map(({ pkg }) => pkg.name));
		const paddingVersion = common.getPadding(pkgs.map(({ pkg }) => `(v${pkg.version})`));

		const packageInfos = pkgs.map(({ pkg, repo: _repo }) => {
			const name = color.warning(pkg.name.padEnd(paddingName));
			const version = color.dim(`(v${pkg.version})`.padEnd(paddingVersion));
			const repo = color.dim(`(${_repo})`);
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
		const downloadResults = await Promise.allSettled(
			pkgs.map(async (opts) => downloadPackage(opts))
		);

		// Separate successes and failures
		const failures: Array<{ ref: AddonReference; error: string }> = [];
		for (let i = 0; i < downloadResults.length; i++) {
			const result = downloadResults[i];
			if (result.status === 'fulfilled') {
				selectedAddons.push(result.value);
			} else {
				failures.push({
					ref: refs[i],
					error: result.reason instanceof Error ? result.reason.message : 'Unknown error'
				});
			}
		}

		if (failures.length > 0) {
			const failedList = failures.map((f) => color.addon(f.ref.specifier)).join(', ');
			const hints = failures
				.map((f) => `${f.ref.specifier}: ${getErrorHint(f.ref.source)}`)
				.join('\n');
			const errorMsg = `Failed to resolve ${failedList}\n${color.optional(failures.map((f) => f.error).join('\n'))}\n\n${hints}`;
			throw new Error(errorMsg);
		}
		stop('Downloaded community add-on packages');
	} catch (err) {
		stop('Failed to download community add-on packages');
		const msg = err instanceof Error ? err.message : 'Unknown error';
		common.errorAndExit(msg);
	}
	return selectedAddons;
}
