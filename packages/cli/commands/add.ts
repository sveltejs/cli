import fs from 'node:fs';
import path from 'node:path';
import * as v from 'valibot';
import { exec } from 'tinyexec';
import { Command, Option } from 'commander';
import * as p from '@svelte-cli/clack-prompts';
import pc from 'picocolors';
import {
	adderCategories,
	categories,
	communityCategories,
	adderIds,
	getAdderDetails,
	communityAdderIds,
	getCommunityAdder,
	type Category,
	type CommunityCategory
} from '@svelte-cli/adders';
import {
	createOrUpdateFiles,
	createWorkspace,
	findUp,
	installPackages,
	TESTING
} from '@svelte-cli/core/internal';
import type {
	AdderWithoutExplicitArgs,
	ExternalAdderConfig,
	InlineAdderConfig,
	OptionDefinition,
	OptionValues
} from '@svelte-cli/core';
import * as common from '../common.js';
import { Directive, downloadPackage, getPackageJSON } from '../utils/fetch-packages.js';

const AddersSchema = v.array(v.string());
const AdderOptionFlagsSchema = v.object({
	tailwindcss: v.optional(v.array(v.string())),
	drizzle: v.optional(v.array(v.string()))
});
const OptionsSchema = v.strictObject({
	cwd: v.string(),
	install: v.boolean(),
	preconditions: v.boolean(),
	community: v.optional(v.union([AddersSchema, v.boolean()])),
	...AdderOptionFlagsSchema.entries
});
type Options = v.InferOutput<typeof OptionsSchema>;

const adderDetails = adderIds.map((id) => getAdderDetails(id));
const aliases = adderDetails.map((c) => c.config.metadata.alias).filter((v) => v !== undefined);
const addersOptions = getAdderOptionFlags();
const communityDetails: AdderWithoutExplicitArgs[] = [];

// infers the workspace cwd if a `package.json` resides in a parent directory
const defaultPkgPath = findUp(process.cwd(), 'package.json');
const defaultCwd = defaultPkgPath ? path.dirname(defaultPkgPath) : undefined;

export const add = new Command('add')
	.description('Applies specified adders into a project')
	.argument('[adder...]', 'adders to install')
	.option('-C, --cwd <path>', 'path to working directory', defaultCwd)
	.option('--no-install', 'skips installing dependencies')
	.option('--no-preconditions', 'skips validating preconditions')
	.option('--community [adder...]', 'community adders to install')
	.configureHelp(common.helpConfig)
	.action((adderArgs, opts) => {
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

		const adders = v.parse(AddersSchema, adderArgs);
		const options = v.parse(OptionsSchema, opts);

		const invalidAdders = adders.filter((a) => !adderIds.includes(a) && !aliases.includes(a));
		if (invalidAdders.length > 0) {
			console.error(`Invalid adders specified: ${invalidAdders.join(', ')}`);
			process.exit(1);
		}

		const selectedAdders = transformAliases(adders);
		common.runCommand(async () => {
			await runAddCommand(options, selectedAdders);
		});
	});

// adds adder specific option flags to the `add` command
for (const option of addersOptions) {
	add.addOption(option);
}

type SelectedAdder = { type: 'official' | 'community'; adder: AdderWithoutExplicitArgs };
export async function runAddCommand(options: Options, adders: string[]): Promise<void> {
	const selectedAdders: SelectedAdder[] = adders.map((id) => ({
		type: 'official',
		adder: getAdderDetails(id)
	}));
	const official: AdderOption = {};
	const community: AdderOption = {};

	// apply specified options from flags
	for (const adderOption of addersOptions) {
		const adderId = adderOption.attributeName() as keyof Options;
		const specifiedOptions = options[adderId] as string[] | undefined;
		if (!specifiedOptions) continue;

		const details = getAdderDetails(adderId);
		if (!selectedAdders.find((d) => d.adder === details)) {
			selectedAdders.push({ type: 'official', adder: details });
		}

		official[adderId] ??= {};

		const optionEntries = Object.entries(details.config.options);
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
					`Invalid '--${adderId}' option: '${specifiedOption}'\nAvailable options: ${choices.join(', ')}`
				);
			}

			const [questionId, question] = optionEntry;

			// validate that there are no conflicts
			let existingOption = official[adderId][questionId];
			if (existingOption !== undefined) {
				if (typeof existingOption === 'boolean') {
					// need to transform the boolean back to `no-{id}` or `{id}`
					existingOption = existingOption ? questionId : `no-${questionId}`;
				}
				throw new Error(
					`Conflicting '--${adderId}' option: '${specifiedOption}' conflicts with '${existingOption}'`
				);
			}

			official[adderId][questionId] =
				question.type === 'boolean' ? !specifiedOption.startsWith('no-') : specifiedOption;
		}

		// apply defaults to unspecified options
		for (const [id, question] of Object.entries(details.config.options)) {
			// we'll only apply defaults to options that don't explicitly fail their conditions
			if (question.condition?.(official[adderId]) !== false) {
				official[adderId][id] ??= question.default;
			} else {
				// we'll also error out if they specified an option that is incompatible with other options.
				// (e.g. the client isn't available for a given database `--drizzle sqlite mysql2`)
				if (official[adderId][id] !== undefined) {
					throw new Error(
						`Incompatible '--${adderId}' option specified: '${official[adderId][id]}'`
					);
				}
			}
		}
	}

	// we'll let the user choose community adders when `--community` is specified without args
	if (options.community === true) {
		const communityAdderOptions: Record<
			string,
			Array<{ value: string; label: string; hint: string }>
		> = {};
		const communityAdders = await Promise.all(
			communityAdderIds.map(async (x) => ({ id: x, adder: await getCommunityAdder(x) }))
		);
		const communityAdderCategoryKeys = communityAdders.map((x) => x.adder.category);

		// only get categories that are used by community adders
		const allCategories = { ...categories, ...communityCategories };
		const communityAdderCategories = Object.entries(allCategories).filter(([key]) =>
			communityAdderCategoryKeys.includes(key as Category | CommunityCategory)
		);

		for (const [categoryId, category] of communityAdderCategories) {
			communityAdderOptions[category.name] = communityAdders
				.filter((x) => x.adder.category == categoryId)
				.map((x) => ({
					value: x.id,
					label: x.adder.name,
					hint: pc.blueBright(x.adder.website)
				}));
		}

		const selected = await p.groupMultiselect({
			message: 'Which community tools would you like to add to your project?',
			options: communityAdderOptions,
			spacedGroups: true,
			selectableGroups: false,
			required: false
		});

		if (typeof selected === 'symbol') return;

		options.community = selected;
	}

	// validate and download community adders
	if (options.community && options.community?.length > 0) {
		// validate adders
		const adders = options.community.map((id) => {
			// ids with directives are passed unmodified so they can be processed during downloads
			const hasDirective = Object.values(Directive).some((directive) => id.startsWith(directive));
			if (hasDirective) return id;

			const validAdder = communityAdderIds.includes(id);
			if (!validAdder) {
				throw new Error(
					`Invalid community adder specified: '${id}'\nAvailable options: ${communityAdderIds.join(', ')}`
				);
			}
			return id;
		});

		// get adder details from remote adders
		const { start, stop } = p.spinner();
		try {
			start('Resolving community adder packages');
			const pkgs = await Promise.all(
				adders.map(async (id) => {
					const communityAdder = await getCommunityAdder(id).catch(() => undefined);
					const packageName = communityAdder?.npm ?? id;
					const packageDetails = await getPackageJSON({ cwd: options.cwd, packageName });
					return {
						...packageDetails,
						repo: communityAdder?.repo ?? (packageDetails.pkg.repository.url as string)
					};
				})
			);
			stop('Resolved community adder packages');

			p.log.warn(
				'The Svelte maintainers have not reviewed community adders for malicious code. Use at your discretion.'
			);

			const paddingName = getPadding(pkgs.map(({ pkg }) => pkg.name));
			const paddingVersion = getPadding(pkgs.map(({ pkg }) => ` (v${pkg.version})`));

			const packageInfos = pkgs.map(
				({ pkg, repo }) =>
					pc.yellowBright((pkg.name as string).padEnd(paddingName)) +
					pc.dim(` (v${pkg.version})`.padEnd(paddingVersion) + ` (${repo})`)
			);
			p.log.message(packageInfos.join('\n'));

			const confirm = await p.confirm({ message: 'Would you like to continue?' });
			if (confirm !== true) {
				p.cancel('Operation cancelled.');
				process.exit(1);
			}

			start('Downloading community adder packages');
			const details = await Promise.all(pkgs.map(async (opts) => downloadPackage(opts)));
			for (const adder of details) {
				const id = adder.config.metadata.id;
				community[id] ??= {};
				communityDetails.push(adder);
				selectedAdders.push({ type: 'community', adder });
			}
			stop('Downloaded community adder packages');
		} catch (err) {
			stop('Failed to resolve community adder packages', 1);
			throw err;
		}
	}

	// prompt which adders to apply
	if (selectedAdders.length === 0) {
		const adderOptions: Record<string, Array<{ value: string; label: string }>> = {};
		const workspace = createWorkspace(options.cwd);
		const projectType = workspace.kit ? 'kit' : 'svelte';
		for (const [id, { name }] of Object.entries(categories)) {
			const category = adderCategories[id as Category];
			const categoryOptions = category
				.map((id) => {
					const config = getAdderDetails(id).config;
					// we'll only display adders within their respective project types
					if (projectType === 'kit' && !config.metadata.environments.kit) return;
					if (projectType === 'svelte' && !config.metadata.environments.svelte) return;

					return { label: config.metadata.name, value: config.metadata.id };
				})
				.filter((c) => !!c);

			if (categoryOptions.length > 0) {
				adderOptions[name] = categoryOptions;
			}
		}

		const selected = await p.groupMultiselect({
			message: 'What would you like to add to your project?',
			options: adderOptions,
			spacedGroups: true,
			selectableGroups: false,
			required: false
		});
		if (p.isCancel(selected)) {
			p.cancel('Operation cancelled.');
			process.exit(1);
		}

		selected.forEach((id) => selectedAdders.push({ type: 'official', adder: getAdderDetails(id) }));
	}

	// add inter-adder dependencies
	for (const { adder } of selectedAdders) {
		const name = adder.config.metadata.name;
		const dependents =
			adder.config.dependsOn?.filter(
				(dep) => !selectedAdders.some((a) => a.adder.config.metadata.id === dep)
			) ?? [];

		const workspace = createWorkspace(options.cwd);
		for (const depId of dependents) {
			const dependent = adderDetails.find((a) => a.config.metadata.id === depId);
			if (!dependent) throw new Error(`Adder '${name}' depends on an invalid '${depId}'`);

			// check if the dependent adder has already been installed
			let installed = false;
			if (dependent.config.integrationType === 'inline') {
				installed = dependent.config.packages.every(
					// we'll skip the conditions since we don't have any options to supply it
					(p) => p.condition !== undefined || !!workspace.dependencies[p.name]
				);
			}
			if (installed) continue;

			// prompt to install the dependent
			const install = await p.confirm({
				message: `The ${pc.bold(pc.cyan(name))} adder requires ${pc.bold(pc.cyan(depId))} to also be installed. ${pc.green('Install it?')}`
			});
			if (install !== true) {
				p.cancel('Operation cancelled.');
				process.exit(1);
			}
			selectedAdders.push({ type: 'official', adder: dependent });
		}
	}

	// run precondition checks
	if (options.preconditions) {
		const preconditions = selectedAdders
			.flatMap(({ adder }) => adder.checks.preconditions)
			.filter((p) => p !== undefined);

		// add global checks
		const { kit } = createWorkspace(options.cwd);
		const projectType = kit ? 'kit' : 'svelte';
		const adders = selectedAdders.map(({ adder }) => adder);
		const globalPreconditions = common.getGlobalPreconditions(options.cwd, projectType, adders);
		preconditions.unshift(...globalPreconditions.preconditions);

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
	for (const { adder, type } of selectedAdders) {
		const adderId = adder.config.metadata.id;
		const questionPrefix = selectedAdders.length > 1 ? `${adder.config.metadata.name}: ` : '';

		let values: QuestionValues = {};
		if (type === 'official') {
			official[adderId] ??= {};
			values = official[adderId];
		}
		if (type === 'community') {
			community[adderId] ??= {};
			values = community[adderId];
		}

		for (const [questionId, question] of Object.entries(adder.config.options)) {
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
					initialValue: question.default.toString()
				});
			}
			if (p.isCancel(answer)) {
				p.cancel('Operation cancelled.');
				process.exit(1);
			}

			values[questionId] = answer;
		}
	}

	// apply adders
	let filesToFormat: string[] = [];
	if (Object.keys({ ...official, ...community }).length > 0) {
		filesToFormat = await installAdders({ cwd: options.cwd, official, community });
		p.log.success('Successfully installed adders');
	}

	// install dependencies
	let depsStatus;
	if (options.install) {
		depsStatus = await common.suggestInstallingDependencies(options.cwd);
	}

	// format modified/created files with prettier (if available)
	const workspace = createWorkspace(options.cwd);
	if (filesToFormat.length > 0 && depsStatus === 'installed' && workspace.prettier) {
		const { start, stop } = p.spinner();
		start('Formatting modified files');
		try {
			await common.formatFiles(options.cwd, filesToFormat);
			stop('Successfully formatted modified files');
		} catch (e) {
			stop('Failed to format files');
			if (e instanceof Error) p.log.error(e.message);
		}
	}

	// print next steps
	const nextStepsMsg = selectedAdders
		.filter(({ adder }) => adder.config.integrationType === 'inline' && adder.config.nextSteps)
		.map(({ adder }) => adder.config as InlineAdderConfig<any>)
		.map((config) => {
			const metadata = config.metadata;
			let adderMessage = '';
			if (selectedAdders.length > 1) {
				adderMessage = `${pc.green(metadata.name)}:\n`;
			}

			const adderNextSteps = config.nextSteps!({
				options: official[metadata.id],
				cwd: options.cwd,
				colors: pc,
				docs: metadata.website?.documentation
			});
			adderMessage += `- ${adderNextSteps.join('\n- ')}`;
			return adderMessage;
		})
		.join('\n\n');
	if (nextStepsMsg) p.box(nextStepsMsg, 'Next steps');
}

type AdderId = string;
type QuestionValues = OptionValues<any>;
export type AdderOption = Record<AdderId, QuestionValues>;

export type InstallAdderOptions = {
	cwd: string;
	official?: AdderOption;
	community?: AdderOption;
};

/**
 * Installs adders
 * @param options {InstallAdderOptions}
 * @returns a list of paths of modified files
 */
export async function installAdders({
	cwd,
	official = {},
	community = {}
}: InstallAdderOptions): Promise<string[]> {
	const adderDetails = Object.keys(official).map((id) => getAdderDetails(id));
	const commDetails = Object.keys(community).map(
		(id) => communityDetails.find((x) => x.config.metadata.id === id)!
	);
	const details = adderDetails.concat(commDetails);

	// adders might specify that they should be executed after another adder.
	// this orders the adders to (ideally) have adders without dependencies run first
	// and adders with dependencies runs later on, based on the adders they depend on.
	// based on https://stackoverflow.com/a/72030336/16075084
	details.sort((a, b) => {
		if (!a.config.runsAfter) return -1;
		if (!b.config.runsAfter) return 1;

		return a.config.runsAfter.includes(b.config.metadata.id)
			? 1
			: b.config.runsAfter.includes(a.config.metadata.id)
				? -1
				: 0;
	});

	// apply adders
	const filesToFormat = new Set<string>();
	for (const { config } of details) {
		const adderId = config.metadata.id;
		const workspace = createWorkspace(cwd);

		workspace.options = official[adderId] ?? community[adderId];

		// execute adders
		if (config.integrationType === 'inline') {
			const pkgPath = installPackages(config, workspace);
			filesToFormat.add(pkgPath);
			const changedFiles = createOrUpdateFiles(config.files, workspace);
			changedFiles.forEach((file) => filesToFormat.add(file));
		} else if (config.integrationType === 'external') {
			await processExternalAdder(config, cwd);
		} else {
			throw new Error('Unknown integration type');
		}
	}

	return Array.from(filesToFormat);
}

async function processExternalAdder<Args extends OptionDefinition>(
	config: ExternalAdderConfig<Args>,
	cwd: string
) {
	if (!TESTING) p.log.message(`Executing external command ${pc.gray(`(${config.metadata.id})`)}`);

	try {
		await exec('npx', config.command.split(' '), {
			nodeOptions: {
				cwd,
				env: Object.assign(process.env, config.environment ?? {}),
				stdio: TESTING ? 'pipe' : 'inherit'
			}
		});
	} catch (error) {
		const typedError = error as Error;
		throw new Error('Failed executing external command: ' + typedError.message);
	}
}

/**
 * Dedupes and transforms aliases into their respective adder id
 */
function transformAliases(ids: string[]): string[] {
	const set = new Set<string>();
	for (const id of ids) {
		if (aliases.includes(id)) {
			const adder = adderDetails.find((a) => a.config.metadata.alias === id)!;
			set.add(adder.config.metadata.id);
		} else {
			set.add(id);
		}
	}
	return Array.from(set);
}

function getAdderOptionFlags(): Option[] {
	const options: Option[] = [];
	for (const id of adderIds) {
		const details = getAdderDetails(id);
		if (Object.values(details.config.options).length === 0) continue;

		const { defaults, groups } = getOptionChoices(details);
		const choices = Object.entries(groups)
			.map(([group, choices]) => `${pc.dim(`${group}:`)} ${choices.join(', ')}`)
			.join('\n');
		const preset = defaults.join(', ') || 'none';
		const option = new Option(
			`--${id} [options...]`,
			`${id} adder options ${pc.dim(`(preset: ${preset})`)}\n${choices}`
		)
			// presets are applied when `--adder` is specified with no options
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

function getOptionChoices(details: AdderWithoutExplicitArgs) {
	const choices: string[] = [];
	const defaults: string[] = [];
	const groups: Record<string, string[]> = {};
	const options: Record<string, unknown> = {};
	for (const [id, question] of Object.entries(details.config.options)) {
		let values = [];
		const applyDefault = question.condition?.(options) !== false;
		if (question.type === 'boolean') {
			values = [id, `no-${id}`];
			if (applyDefault) {
				options[id] = question.default;
				defaults.push(question.default ? values[0] : values[1]);
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

function getPadding(strs: string[]) {
	const lengths = strs.map((s) => s.length);
	return Math.max(...lengths);
}
