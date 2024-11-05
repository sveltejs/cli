import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import * as v from 'valibot';
import { exec } from 'tinyexec';
import { Command, Option } from 'commander';
import * as p from '@sveltejs/clack-prompts';
import * as pkg from 'empathic/package';
import { resolveCommand, type AgentName } from 'package-manager-detector';
import pc from 'picocolors';
import {
	officialAdders,
	getAdderDetails,
	communityAdderIds,
	getCommunityAdder
} from '@sveltejs/adders';
import type {
	AdderSetupResult,
	AdderWithoutExplicitArgs,
	OptionValues,
	SvApi
} from '@sveltejs/cli-core';
import * as common from '../../common.ts';
import { Directive, downloadPackage, getPackageJSON } from '../../utils/fetch-packages.ts';
import { createWorkspace } from './workspace.ts';
import { fileExists, getHighlighter, installPackages, readFile, writeFile } from './utils.ts';

const AddersSchema = v.array(v.string());
const AdderOptionFlagsSchema = v.object({
	tailwindcss: v.optional(v.array(v.string())),
	drizzle: v.optional(v.array(v.string())),
	lucia: v.optional(v.array(v.string())),
	paraglide: v.optional(v.array(v.string()))
});
const OptionsSchema = v.strictObject({
	cwd: v.string(),
	install: v.boolean(),
	preconditions: v.boolean(),
	community: v.optional(v.union([AddersSchema, v.boolean()])),
	...AdderOptionFlagsSchema.entries
});
type Options = v.InferOutput<typeof OptionsSchema>;

const aliases = officialAdders.map((c) => c.alias).filter((v) => v !== undefined);
const addersOptions = getAdderOptionFlags();
const communityDetails: AdderWithoutExplicitArgs[] = [];

// infers the workspace cwd if a `package.json` resides in a parent directory
const defaultPkgPath = pkg.up();
const defaultCwd = defaultPkgPath ? path.dirname(defaultPkgPath) : undefined;

export const add = new Command('add')
	.description('applies specified add-ons into a project')
	.argument('[add-on...]', 'add-ons to install')
	.option('-C, --cwd <path>', 'path to working directory', defaultCwd)
	.option('--no-install', 'skip installing dependencies')
	.option('--no-preconditions', 'skip validating preconditions')
	//.option('--community [adder...]', 'community adders to install')
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

		const specifiedAdders = v.parse(AddersSchema, adderArgs);
		const options = v.parse(OptionsSchema, opts);
		const adderIds = officialAdders.map((adder) => adder.id);
		const invalidAdders = specifiedAdders.filter(
			(a) => !adderIds.includes(a) && !aliases.includes(a)
		);
		if (invalidAdders.length > 0) {
			console.error(`Invalid adders specified: ${invalidAdders.join(', ')}`);
			process.exit(1);
		}

		const selectedAdders = transformAliases(specifiedAdders);
		common.runCommand(async () => {
			const { nextSteps } = await runAddCommand(options, selectedAdders);
			if (nextSteps) p.box(nextSteps, 'Next steps');
		});
	});

// adds adder specific option flags to the `add` command
for (const option of addersOptions) {
	add.addOption(option);
}

type SelectedAdder = {
	type: 'official' | 'community';
	adder: AdderWithoutExplicitArgs;
};
export async function runAddCommand(
	options: Options,
	selectedAdderIds: string[]
): Promise<{ nextSteps?: string; packageManager?: AgentName | null }> {
	const selectedAdders: SelectedAdder[] = selectedAdderIds.map((id) => ({
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
		for (const [id, question] of Object.entries(details.options)) {
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
		const communityAdders = await Promise.all(
			communityAdderIds.map(async (id) => await getCommunityAdder(id))
		);

		const promptOptions = communityAdders.map((adder) => ({
			value: adder.id,
			label: adder.id,
			hint: 'https://www.npmjs.com/package/' + adder.id
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
			p.cancel('No adders selected. Exiting.');
			process.exit(1);
		}

		options.community = selected;
	}

	// validate and download community adders
	if (Array.isArray(options.community) && options.community.length > 0) {
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
					return await getPackageJSON({ cwd: options.cwd, packageName: id });
				})
			);
			stop('Resolved community adder packages');

			p.log.warn(
				'The Svelte maintainers have not reviewed community adders for malicious code. Use at your discretion.'
			);

			const paddingName = getPadding(pkgs.map(({ pkg }) => pkg.name));
			const paddingVersion = getPadding(pkgs.map(({ pkg }) => `(v${pkg.version})`));

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

			start('Downloading community adder packages');
			const details = await Promise.all(pkgs.map(async (opts) => downloadPackage(opts)));
			for (const adder of details) {
				const id = adder.id;
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

	// prepare official adders
	let workspace = createWorkspace({ cwd: options.cwd });
	const adderSetupResults: Record<AdderId, AdderSetupResult> = {};
	for (const officialAdder of officialAdders) {
		const setupResult: AdderSetupResult = {
			available: true,
			dependsOn: []
		};
		officialAdder.setup?.({
			...workspace,
			dependsOn: (name) => setupResult.dependsOn.push(name),
			unavailable: () => (setupResult.available = false)
		});
		adderSetupResults[officialAdder.id] = setupResult;
	}

	// prompt which adders to apply
	if (selectedAdders.length === 0) {
		const adderOptions = officialAdders
			.map((adder) => {
				// we'll only display adders within their respective project types
				const adderSetupResult = adderSetupResults[adder.id];
				if (!adderSetupResult.available) return;

				return {
					label: adder.id,
					value: adder.id,
					hint: adder.homepage
				};
			})
			.filter((a) => !!a);

		const selected = await p.multiselect({
			message: `What would you like to add to your project? ${pc.dim('(use arrow keys / space bar)')}`,
			options: adderOptions,
			required: false
		});
		if (p.isCancel(selected)) {
			p.cancel('Operation cancelled.');
			process.exit(1);
		}

		selected.forEach((id) =>
			selectedAdders.push({ type: 'official', adder: officialAdders.find((x) => x.id == id)! })
		);
	}

	// add inter-adder dependencies
	for (const { adder } of selectedAdders) {
		workspace = createWorkspace({ cwd: options.cwd });
		const adderSetupResult = adderSetupResults[adder.id];

		const dependents = adderSetupResult.dependsOn;
		const filteredDependents =
			dependents.filter((dep) => !selectedAdders.some((a) => a.adder.id === dep)) ?? [];

		for (const depId of filteredDependents) {
			const dependent = officialAdders.find((a) => a.id === depId) as AdderWithoutExplicitArgs;

			const install = await p.confirm({
				message: `The ${pc.bold(pc.cyan(adder.id))} add-on requires ${pc.bold(pc.cyan(depId))} to also be setup. ${pc.green('Include it?')}`
			});
			if (install !== true) {
				p.cancel('Operation cancelled.');
				process.exit(1);
			}
			selectedAdders.push({ type: 'official', adder: dependent });
		}
	}

	// run precondition checks
	if (options.preconditions && selectedAdders.length > 0) {
		// add global checks
		const { kit } = createWorkspace({ cwd: options.cwd });
		const projectType = kit ? 'kit' : 'svelte';
		const adders = selectedAdders.map(({ adder }) => adder);
		const { preconditions } = common.getGlobalPreconditions(
			options.cwd,
			projectType,
			adders,
			adderSetupResults
		);

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
		const adderId = adder.id;
		const questionPrefix = selectedAdders.length > 1 ? `${adder.id}: ` : '';

		let values: QuestionValues = {};
		if (type === 'official') {
			official[adderId] ??= {};
			values = official[adderId];
		}
		if (type === 'community') {
			community[adderId] ??= {};
			values = community[adderId];
		}

		for (const [questionId, question] of Object.entries(adder.options)) {
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

	// we'll return early when no adders are selected,
	// indicating that installing deps was skipped and no PM was selected
	if (selectedAdders.length === 0) return { packageManager: null };

	// prompt for package manager
	let packageManager: AgentName | undefined;
	if (options.install) {
		packageManager = await common.packageManagerPrompt(options.cwd);
	}

	// apply adders
	const filesToFormat = await runAdders({
		cwd: options.cwd,
		packageManager,
		official,
		community,
		adderSetupResults
	});
	p.log.success('Successfully setup add-ons');

	// install dependencies
	if (packageManager && options.install) {
		await common.installDependencies(packageManager, options.cwd);
	}

	// format modified/created files with prettier (if available)
	workspace = createWorkspace({ cwd: options.cwd, packageManager });
	if (filesToFormat.length > 0 && packageManager && !!workspace.dependencyVersion('prettier')) {
		const { start, stop } = p.spinner();
		start('Formatting modified files');
		try {
			await common.formatFiles({ packageManager, cwd: options.cwd, paths: filesToFormat });
			stop('Successfully formatted modified files');
		} catch (e) {
			stop('Failed to format files');
			if (e instanceof Error) p.log.error(e.message);
		}
	}

	const highlighter = getHighlighter();

	// print next steps
	const nextSteps =
		selectedAdders
			.filter(({ adder }) => adder.nextSteps)
			.map(({ adder }) => {
				let adderMessage = '';
				if (selectedAdders.length > 1) {
					adderMessage = `${pc.green(adder.id)}:\n`;
				}

				const adderNextSteps = adder.nextSteps!({
					...workspace,
					options: official[adder.id]!,
					highlighter
				});
				adderMessage += `- ${adderNextSteps.join('\n- ')}`;
				return adderMessage;
			})
			// instead of returning an empty string, we'll return `undefined`
			.join('\n\n') || undefined;

	return { nextSteps, packageManager };
}

type AdderId = string;
type QuestionValues = OptionValues<any>;
export type AdderOption = Record<AdderId, QuestionValues>;

export type InstallAdderOptions = {
	cwd: string;
	packageManager?: AgentName;
	official?: AdderOption;
	community?: AdderOption;
	adderSetupResults: Record<AdderId, AdderSetupResult>;
};

/**
 * @returns a list of paths of modified files
 */
async function runAdders({
	cwd,
	official = {},
	community = {},
	packageManager,
	adderSetupResults = {}
}: InstallAdderOptions): Promise<string[]> {
	const adderDetails = Object.keys(official).map((id) => getAdderDetails(id));
	const commDetails = Object.keys(community).map(
		(id) => communityDetails.find((a) => a.id === id)!
	);
	const details = adderDetails.concat(commDetails);

	// adders might specify that they should be executed after another adder.
	// this orders the adders to (ideally) have adders without dependencies run first
	// and adders with dependencies runs later on, based on the adders they depend on.
	// based on https://stackoverflow.com/a/72030336/16075084
	details.sort((a, b) => {
		const aDeps = adderSetupResults[a.id].dependsOn;
		const bDeps = adderSetupResults[b.id].dependsOn;
		if (!aDeps && !bDeps) return 0;
		if (!aDeps) return -1;
		if (!bDeps) return 1;

		return aDeps.includes(b.id) ? 1 : bDeps.includes(a.id) ? -1 : 0;
	});

	// apply adders
	const filesToFormat = new Set<string>();
	for (const adder of details) {
		const adderId = adder.id;
		const workspace = createWorkspace({ cwd, packageManager });

		workspace.options = official[adderId] ?? community[adderId]!;

		// execute adders
		const dependencies: Array<{ pkg: string; version: string; dev: boolean }> = [];
		const sv: SvApi = {
			file: (path, content) => {
				const exists = fileExists(workspace.cwd, path);
				let fileContent = exists ? readFile(workspace.cwd, path) : '';
				// process file
				fileContent = content(fileContent);

				writeFile(workspace, path, fileContent);
				filesToFormat.add(path);

				return fileContent;
			},
			execute: async (commandArgs, stdio) => {
				const { command, args } = resolveCommand(workspace.packageManager, 'execute', commandArgs)!;
				const adderPrefix = details.length > 1 ? `${adder.id}: ` : '';
				const executedCommandDisplayName = `${command} ${args.join(' ')}`;
				p.log.step(
					`${adderPrefix}Running external command ${pc.gray(`(${executedCommandDisplayName})`)}`
				);

				// adding --yes as the first parameter helps avoiding the "Need to install the following packages:" message
				if (workspace.packageManager === 'npm') args.unshift('--yes');

				try {
					await exec(command, args, { nodeOptions: { cwd: workspace.cwd, stdio } });
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
		await adder.run({ ...workspace, sv });

		installPackages(dependencies, workspace);
	}

	return Array.from(filesToFormat);
}

/**
 * Dedupes and transforms aliases into their respective adder id
 */
function transformAliases(ids: string[]): string[] {
	const set = new Set<string>();
	for (const id of ids) {
		if (aliases.includes(id)) {
			const adder = officialAdders.find((a) => a.alias === id)!;
			set.add(adder.id);
		} else {
			set.add(id);
		}
	}
	return Array.from(set);
}

function getAdderOptionFlags(): Option[] {
	const options: Option[] = [];
	for (const adder of officialAdders) {
		const id = adder.id;
		const details = getAdderDetails(id);
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

function getPadding(lines: string[]) {
	const lengths = lines.map((s) => s.length);
	return Math.max(...lengths);
}
