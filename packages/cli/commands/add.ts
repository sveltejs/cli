import * as v from 'valibot';
import { Argument, Command, Option } from 'commander';
import * as p from '@svelte-cli/clack-prompts';
import pc from 'picocolors';
import {
	executeCli,
	formatFiles,
	getGlobalPreconditions,
	suggestInstallingDependencies,
	wrap
} from '../common.js';
import { adderCategories, categories, adderIds, communityAdders } from '@svelte-cli/adders';
import { getAdderConfig, getAdderDetails } from '../../adders/index.js';
import {
	createOrUpdateFiles,
	createWorkspace,
	installPackages,
	TESTING
} from '@svelte-cli/core/internal';
import {
	type ExternalAdderConfig,
	type InlineAdderConfig,
	type OptionDefinition,
	type OptionValues
} from '@svelte-cli/core';

const AddersSchema = v.array(v.string());
const OptionsSchema = v.strictObject({
	cwd: v.string(),
	install: v.boolean(),
	preconditions: v.boolean(),
	default: v.boolean()
	// community: AddersSchema
});
type Options = v.InferOutput<typeof OptionsSchema>;

const adderDetails = adderIds.map((id) => getAdderDetails(id));
const aliases = adderDetails.map((c) => c.config.metadata.alias).filter((v) => v !== undefined);

// const communityOptions = new Option('--community [adder...]', 'community adders to install')
//.choices(communityAdders.map((a) => a.id));

const adderArg = new Argument('[adder...]', 'adders to install');

export const add = new Command('add')
	.description('Applies specified adders into a project')
	.addArgument(adderArg)
	.option('--cwd <path>', 'path to working directory', process.cwd())
	.option('--no-install', 'skips installing dependencies')
	.option('--no-preconditions', 'skips validating preconditions')
	.option('--default', 'applies default adder options for unspecified options', false)
	// .addOption(communityOptions)
	.action(async (adderArgs, opts) => {
		const adders = v.parse(AddersSchema, adderArgs);
		const options = v.parse(OptionsSchema, opts);

		const invalidAdders = adders.filter((a) => !adderIds.includes(a) && !aliases.includes(a));
		if (invalidAdders.length > 0) {
			console.error(`Invalid adders specified: ${invalidAdders.join(', ')}`);
			process.exit(1);
		}

		const deduped = transformAliases(adders);

		await wrap(async () => await runAddCommand(options, deduped));
	});

export async function runAddCommand(options: Options, adders: string[]): Promise<void> {
	const selectedAdders = adders.map((id) => getAdderDetails(id));
	// prompt which adders to apply
	if (selectedAdders.length === 0) {
		const adderOptions: Record<string, Array<{ value: string; label: string }>> = {};
		const workspace = createWorkspace(options.cwd);
		const projectType = workspace.kit ? 'kit' : 'svelte';
		for (const { id, name } of Object.values(categories)) {
			const category = adderCategories[id];
			const categoryOptions = category
				.map((id) => {
					const config = getAdderConfig(id);
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

		selected.forEach((id) => selectedAdders.push(getAdderDetails(id)));
	}

	// run precondition checks
	if (options.preconditions) {
		const preconditions = selectedAdders
			.flatMap((c) => c.checks.preconditions)
			.filter((p) => p !== undefined);

		// add global checks
		const { kit } = createWorkspace(options.cwd);
		const projectType = kit ? 'kit' : 'svelte';
		const globalPreconditions = getGlobalPreconditions(options.cwd, projectType, selectedAdders);
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

	const official: AdderOption = {};
	const community = {};

	// TODO: apply specified options from flags

	// apply defaults to unspecified options
	if (options.default) {
		for (const adder of selectedAdders) {
			const adderId = adder.config.metadata.id;
			official[adderId] ??= {};
			for (const [id, question] of Object.entries(adder.config.options)) {
				official[adderId][id] ??= question.default;
			}
		}
	}

	// ask remaining questions
	for (const adder of selectedAdders) {
		const adderId = adder.config.metadata.id;
		const questionPrefix = selectedAdders.length > 1 ? `${adder.config.metadata.name}: ` : '';
		official[adderId] ??= {};
		for (const [questionId, question] of Object.entries(adder.config.options)) {
			const shouldAsk = question.condition?.(official[adderId]);
			if (shouldAsk === false || official[adderId][questionId] !== undefined) continue;

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

			official[adderId][questionId] = answer;
		}
	}

	// apply adders
	let filesToFormat: string[] = [];
	if (Object.keys({ ...official, ...community }).length > 0) {
		filesToFormat = await installAdders({ cwd: options.cwd, official, community });
		p.log.success('Successfully installed adders');
	}

	// TODO: run postconditions?

	// install dependencies
	let depsInstalled;
	if (options.install) {
		depsInstalled = await suggestInstallingDependencies(options.cwd);
	}

	// format modified/created files with prettier (if available)
	const workspace = createWorkspace(options.cwd);
	if (depsInstalled === 'installed' && workspace.prettier) {
		const formatSpinner = p.spinner();
		formatSpinner.start('Formatting modified files');
		try {
			await formatFiles(options.cwd, filesToFormat);
			formatSpinner.stop('Successfully formatted modified files');
		} catch (e) {
			formatSpinner.stop('Failed to format files');
			if (e instanceof Error) p.log.error(e.message);
		}
	}

	// print next steps
	const nextStepsMsg = selectedAdders
		.filter((a) => a.config.integrationType === 'inline' && a.config.nextSteps)
		.map((a) => a.config as InlineAdderConfig<any>)
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
	if (nextStepsMsg) p.note(nextStepsMsg, 'Next steps');
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
	official = {}
}: InstallAdderOptions): Promise<string[]> {
	const adderDetails = Object.keys(official).map((id) => getAdderDetails(id));

	// adders might specify that they should be executed after another adder.
	// this orders the adders to (ideally) have adders without dependencies run first
	// and adders with dependencies runs later on, based on the adders they depend on.
	// based on https://stackoverflow.com/a/72030336/16075084
	adderDetails.sort((a, b) => {
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
	for (const { config } of adderDetails) {
		const adderId = config.metadata.id;
		const workspace = createWorkspace(cwd);

		workspace.options = official[adderId];

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
	if (!TESTING) p.log.message('Executing external command');

	try {
		await executeCli('npx', config.command.split(' '), cwd, {
			env: Object.assign(process.env, config.environment ?? {}),
			stdio: TESTING ? 'pipe' : 'inherit'
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

// other possivel variations
// npx sv add drizzle tailwindcss --options postgresql,postgres.js,no-docker no-typography
// npx sv add drizzle=postgresql,postgres.js,no-docker tailwindcss=no-typography
// `sv add drizzle tailwindcss --drizzle db:postgresql client:postgres.js docker:false --tailwindcss typography:false`

// TODO: PoC for `sv add --drizzle=postgresql,postgres.js,no-docker --tailwindcss=no-typography`
// const addersOptions: Option[] = [];
// for (const id of adderIds) {
// 	const details = getAdderDetails(id);
// 	if (Object.values(details.config.options).length === 0) continue;

// 	const option = new Option(`--${id} <options>`).argParser((value) => value.split(','));
// 	const choices: string[] = [];
// 	for (const [key, question] of Object.entries(details.config.options)) {
// 		if (question.type === 'boolean') {
// 			const values = [key, `no-${key}`];
// 			choices.push(...values);
// 		}
// 		if (question.type === 'select') {
// 			const values = question.options.map((o) => o.value);
// 			choices.push(...values);
// 		}
// 	}
// 	option.choices(choices);
// 	addersOptions.push(option);
// }

// for (const option of addersOptions) {
// 	add.addOption(option);
// }
