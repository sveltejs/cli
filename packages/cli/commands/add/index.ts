import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import pc from 'picocolors';
import * as v from 'valibot';
import * as pkg from 'empathic/package';
import * as p from '@sveltejs/clack-prompts';
import { Command, Option } from 'commander';
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
import { installDependencies, packageManagerPrompt } from '../../utils/package-manager.ts';
import { getGlobalPreconditions } from './preconditions.ts';
import { type AddonMap, applyAddons, setupAddons } from '../../lib/install.ts';

const AddonsSchema = v.array(v.string());
const AddonOptionFlagsSchema = v.object({
	tailwindcss: v.optional(v.array(v.string())),
	drizzle: v.optional(v.array(v.string())),
	lucia: v.optional(v.array(v.string())),
	paraglide: v.optional(v.array(v.string()))
});
const OptionsSchema = v.strictObject({
	cwd: v.string(),
	install: v.boolean(),
	preconditions: v.boolean(),
	community: v.optional(v.union([AddonsSchema, v.boolean()])),
	...AddonOptionFlagsSchema.entries
});
type Options = v.InferOutput<typeof OptionsSchema>;

const aliases = officialAddons.map((c) => c.alias).filter((v) => v !== undefined);
const addonsOptions = getAddonOptionFlags();
const communityDetails: AddonWithoutExplicitArgs[] = [];

// infers the workspace cwd if a `package.json` resides in a parent directory
const defaultPkgPath = pkg.up();
const defaultCwd = defaultPkgPath ? path.dirname(defaultPkgPath) : undefined;

export const add = new Command('add')
	.description('applies specified add-ons into a project')
	.argument('[add-on...]', 'add-ons to install')
	.option('-C, --cwd <path>', 'path to working directory', defaultCwd)
	.option('--no-install', 'skip installing dependencies')
	.option('--no-preconditions', 'skip validating preconditions')
	//.option('--community [add-on...]', 'community addons to install')
	.configureHelp(common.helpConfig)
	.action((addonArgs, opts) => {
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

		const specifiedAddons = v.parse(AddonsSchema, addonArgs);
		const options = v.parse(OptionsSchema, opts);
		const addonIds = officialAddons.map((addon) => addon.id);
		const invalidAddons = specifiedAddons.filter(
			(a) => !addonIds.includes(a) && !aliases.includes(a)
		);
		if (invalidAddons.length > 0) {
			console.error(`Invalid add-ons specified: ${invalidAddons.join(', ')}`);
			process.exit(1);
		}

		const selectedAddons = transformAliases(specifiedAddons);
		common.runCommand(async () => {
			const { nextSteps } = await runAddCommand(options, selectedAddons);
			if (nextSteps) p.box(nextSteps, 'Next steps');
		});
	});

// adds addon specific option flags to the `add` command
for (const option of addonsOptions) {
	add.addOption(option);
}

type SelectedAddon = { type: 'official' | 'community'; addon: AddonWithoutExplicitArgs };
export async function runAddCommand(
	options: Options,
	selectedAddonIds: string[]
): Promise<{ nextSteps?: string; packageManager?: AgentName | null }> {
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
	for (const addonOption of addonsOptions) {
		const addonId = addonOption.attributeName() as keyof Options;
		const specifiedOptions = options[addonId] as string[] | undefined;
		if (!specifiedOptions) continue;

		const details = getAddonDetails(addonId);
		if (!selectedAddons.find((d) => d.addon === details)) {
			selectedAddons.push({ type: 'official', addon: details });
		}

		official[addonId] ??= {};

		const optionEntries = Object.entries(details.options);
		for (const specifiedOption of specifiedOptions) {
			// we'll skip empty string and `none` options so that default values can be applied later
			if (!specifiedOption || specifiedOption === 'none') continue;

			// figure out which option it belongs to
			const optionEntry = optionEntries.find(([id, question]) => {
				if (question.type === 'boolean') {
					return id === specifiedOption || `no-${id}` === specifiedOption;
				}
				if (question.type === 'select' || question.type === 'multiselect') {
					return question.options.some((o) => o.value === specifiedOption);
				}
			});
			if (!optionEntry) {
				const { choices } = getOptionChoices(details);
				throw new Error(
					`Invalid '--${addonId}' option: '${specifiedOption}'\nAvailable options: ${choices.join(', ')}`
				);
			}

			const [questionId, question] = optionEntry;

			// validate that there are no conflicts
			let existingOption = official[addonId][questionId];
			if (existingOption !== undefined) {
				if (typeof existingOption === 'boolean') {
					// need to transform the boolean back to `no-{id}` or `{id}`
					existingOption = existingOption ? questionId : `no-${questionId}`;
				}
				throw new Error(
					`Conflicting '--${addonId}' option: '${specifiedOption}' conflicts with '${existingOption}'`
				);
			}

			official[addonId][questionId] =
				question.type === 'boolean' ? !specifiedOption.startsWith('no-') : specifiedOption;
		}

		// apply defaults to unspecified options
		for (const [id, question] of Object.entries(details.options)) {
			// we'll only apply defaults to options that don't explicitly fail their conditions
			if (question.condition?.(official[addonId]) !== false) {
				official[addonId][id] ??= question.default;
			} else {
				// we'll also error out if they specified an option that is incompatible with other options.
				// (e.g. the client isn't available for a given database `--drizzle sqlite mysql2`)
				if (official[addonId][id] !== undefined) {
					throw new Error(
						`Incompatible '--${addonId}' option specified: '${official[addonId][id]}'`
					);
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
	let workspace = createWorkspace({ cwd: options.cwd });
	const addonSetupResults = setupAddons(officialAddons, workspace);

	// prompt which addons to apply
	if (selectedAddons.length === 0) {
		const addonOptions = officialAddons
			// only display supported addons relative to the current environment
			.filter(({ id }) => addonSetupResults[id].unsupported.length === 0)
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
		workspace = createWorkspace(workspace);

		const setupResult = addonSetupResults[addon.id];
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

	// run precondition checks
	if (options.preconditions && selectedAddons.length > 0) {
		// add global checks
		const addons = selectedAddons.map(({ addon }) => addon);
		const { preconditions } = getGlobalPreconditions(options.cwd, addons, addonSetupResults);

		const fails: Array<{ name: string; message?: string }> = [];
		for (const condition of preconditions) {
			const { message, success } = await condition.run();
			if (!success) fails.push({ name: condition.name, message });
		}

		if (fails.length > 0) {
			const message = fails
				.map(({ name, message }) => pc.yellow(`${name} (${message})`))
				.join('\n- ');

			p.note(`- ${message}`, 'Preconditions not met');

			const force = await p.confirm({
				message: 'Preconditions failed. Do you wish to continue?',
				initialValue: false
			});
			if (p.isCancel(force) || !force) {
				p.cancel('Operation cancelled.');
				process.exit(1);
			}
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
					required: false,
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
	if (selectedAddons.length === 0) return { packageManager: null };

	// prompt for package manager
	let packageManager: PackageManager | undefined;
	if (options.install) {
		packageManager = await packageManagerPrompt(options.cwd);
		if (packageManager) workspace.packageManager = packageManager;
	}

	// apply addons
	const officialDetails = Object.keys(official).map((id) => getAddonDetails(id));
	const commDetails = Object.keys(community).map(
		(id) => communityDetails.find((a) => a.id === id)!
	);
	const details = officialDetails.concat(commDetails);

	const addonMap: AddonMap = Object.assign({}, ...details.map((a) => ({ [a.id]: a })));
	const filesToFormat = await applyAddons({
		workspace,
		addonSetupResults,
		addons: addonMap,
		options: official
	});

	p.log.success('Successfully setup add-ons');

	// install dependencies
	if (packageManager && options.install) {
		await installDependencies(packageManager, options.cwd);
	}

	// format modified/created files with prettier (if available)
	workspace = createWorkspace(workspace);
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
	const nextSteps =
		selectedAddons
			.filter(({ addon }) => addon.nextSteps)
			.map(({ addon }) => {
				let addonMessage = '';
				if (selectedAddons.length > 1) {
					addonMessage = `${pc.green(addon.id)}:\n`;
				}

				const addonNextSteps = addon.nextSteps!({
					...workspace,
					options: official[addon.id]!,
					highlighter
				});
				addonMessage += `- ${addonNextSteps.join('\n- ')}`;
				return addonMessage;
			})
			// instead of returning an empty string, we'll return `undefined`
			.join('\n\n') || undefined;

	return { nextSteps, packageManager };
}

/**
 * Dedupes and transforms aliases into their respective addon id
 */
function transformAliases(ids: string[]): string[] {
	const set = new Set<string>();
	for (const id of ids) {
		if (aliases.includes(id)) {
			const addon = officialAddons.find((a) => a.alias === id)!;
			set.add(addon.id);
		} else {
			set.add(id);
		}
	}
	return Array.from(set);
}

function getAddonOptionFlags(): Option[] {
	const options: Option[] = [];
	for (const addon of officialAddons) {
		const id = addon.id;
		const details = getAddonDetails(id);
		if (Object.values(details.options).length === 0) continue;

		const { defaults, groups } = getOptionChoices(details);
		const choices = Object.entries(groups)
			.map(([group, choices]) => `${pc.dim(`${group}:`)} ${choices.join(', ')}`)
			.join('\n');
		const preset = defaults.join(', ') || 'none';
		const option = new Option(
			`--${id} [options...]`,
			`${id} add-on options ${pc.dim(`(preset: ${preset})`)}\n${choices}`
		)
			// presets are applied when `--{addonName}` is specified with no options
			.preset(preset)
			.argParser((value, prev: string[]) => {
				prev ??= [];
				prev = prev.concat(value.split(/\s|,/));
				return prev;
			});

		options.push(option);
	}
	return options;
}

function getOptionChoices(details: AddonWithoutExplicitArgs) {
	const choices: string[] = [];
	const defaults: string[] = [];
	const groups: Record<string, string[]> = {};
	const options: Record<string, unknown> = {};
	for (const [id, question] of Object.entries(details.options)) {
		let values: string[] = [];
		const applyDefault = question.condition?.(options) !== false;
		if (question.type === 'boolean') {
			values = [id, `no-${id}`];
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

		choices.push(...values);

		// we'll fallback to the question's id
		const groupId = question.group ?? id;
		groups[groupId] ??= [];
		groups[groupId].push(...values);
	}
	return { choices, defaults, groups };
}
