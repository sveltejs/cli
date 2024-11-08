import process from 'node:process';
import pc from 'picocolors';
import pkg from './package.json';
import { exec } from 'tinyexec';
import * as p from '@sveltejs/clack-prompts';
import { AGENTS, type AgentName, detectSync } from 'package-manager-detector';
import { COMMANDS, constructCommand, resolveCommand } from 'package-manager-detector/commands';
import type { Argument, HelpConfiguration, Option } from 'commander';
import type { AdderWithoutExplicitArgs, Precondition } from '@sveltejs/cli-core';

const NO_PREFIX = '--no-';
let options: readonly Option[] = [];

function getLongFlag(flags: string) {
	return flags
		.split(',')
		.map((f) => f.trim())
		.find((f) => f.startsWith('--'));
}

export const helpConfig: HelpConfiguration = {
	argumentDescription: formatDescription,
	optionDescription: formatDescription,
	visibleOptions(cmd) {
		// hack so that we can access existing options in `optionTerm`
		options = cmd.options;

		const visible = cmd.options.filter((o) => !o.hidden);
		const show: Option[] = [];
		// hide any `--no-` flag variants if there's an existing flag of a similar name
		// e.g. `--types` and `--no-types` will combine into a single `--[no-]types` flag
		for (const option of visible) {
			const flag = getLongFlag(option.flags);
			if (flag?.startsWith(NO_PREFIX)) {
				const stripped = flag.slice(NO_PREFIX.length);
				const isNoVariant = visible.some((o) => getLongFlag(o.flags)?.startsWith(`--${stripped}`));
				if (isNoVariant) continue;
			}
			show.push(option);
		}
		return show;
	},
	optionTerm(option) {
		const longFlag = getLongFlag(option.flags);
		const flag = longFlag?.split(' ').at(0);
		if (!flag || !longFlag) return option.flags;

		// check if there's a `--no-{flag}` variant
		const noVariant = `--no-${flag.slice(2)}`;
		const hasVariant = options.some((o) => getLongFlag(o.flags) === noVariant);
		if (hasVariant) {
			return `--[no-]${longFlag.slice(2)}`;
		}

		return option.flags;
	}
};

function formatDescription(arg: Option | Argument): string {
	let output = arg.description;
	if (arg.defaultValue !== undefined && String(arg.defaultValue)) {
		output += pc.dim(` (default: ${JSON.stringify(arg.defaultValue)})`);
	}
	if (arg.argChoices !== undefined && String(arg.argChoices)) {
		output += pc.dim(` (choices: ${arg.argChoices.join(', ')})`);
	}
	return output;
}

type MaybePromise = () => Promise<void> | void;

export async function runCommand(action: MaybePromise): Promise<void> {
	try {
		p.intro(`Welcome to the Svelte CLI! ${pc.gray(`(v${pkg.version})`)}`);
		await action();
		p.outro("You're all set!");
	} catch (e) {
		p.cancel('Operation failed.');
		if (e instanceof Error) {
			console.error(e.stack ?? e);
		}
	}
}

export async function formatFiles(options: {
	packageManager: AgentName;
	cwd: string;
	paths: string[];
}): Promise<void> {
	const args = ['prettier', '--write', '--ignore-unknown', ...options.paths];
	const cmd = resolveCommand(options.packageManager, 'execute-local', args)!;
	await exec(cmd.command, cmd.args, {
		nodeOptions: { cwd: options.cwd, stdio: 'pipe' },
		throwOnError: true
	});
}

const agents = AGENTS.filter((agent): agent is AgentName => !agent.includes('@'));
const agentOptions: PackageManagerOptions = agents.map((pm) => ({ value: pm, label: pm }));
agentOptions.unshift({ label: 'None', value: undefined });

type PackageManagerOptions = Array<{ value: AgentName | undefined; label: AgentName | 'None' }>;
export async function packageManagerPrompt(cwd: string): Promise<AgentName | undefined> {
	const detected = detectSync({ cwd });
	const agent = detected?.name ?? getUserAgent();

	const pm = await p.select({
		message: 'Which package manager do you want to install dependencies with?',
		options: agentOptions,
		initialValue: agent
	});
	if (p.isCancel(pm)) {
		p.cancel('Operation cancelled.');
		process.exit(1);
	}

	return pm;
}

export async function installDependencies(agent: AgentName, cwd: string): Promise<void> {
	const spinner = p.spinner();
	spinner.start('Installing dependencies...');
	try {
		const { command, args } = constructCommand(COMMANDS[agent].install, [])!;
		await exec(command, args, { nodeOptions: { cwd }, throwOnError: true });

		spinner.stop('Successfully installed dependencies');
	} catch (error) {
		spinner.stop('Failed to install dependencies', 2);
		throw error;
	}
}

export function getUserAgent(): AgentName | undefined {
	const userAgent = process.env.npm_config_user_agent;
	if (!userAgent) return undefined;

	const pmSpec = userAgent.split(' ')[0]!;
	const separatorPos = pmSpec.lastIndexOf('/');
	const name = pmSpec.substring(0, separatorPos) as AgentName;
	return AGENTS.includes(name) ? name : undefined;
}

type PreconditionCheck = { name: string; preconditions: Precondition[] };
export function getGlobalPreconditions(
	cwd: string,
	projectType: 'svelte' | 'kit',
	adders: AdderWithoutExplicitArgs[]
): PreconditionCheck {
	return {
		name: 'global checks',
		preconditions: [
			{
				name: 'clean working directory',
				run: async () => {
					try {
						// If a user has pending git changes the output of the following command will list
						// all files that have been added/modified/deleted and thus the output will not be empty.
						// In case the output of the command below is an empty text, we can safely assume
						// there are no pending changes. If the below command is run outside of a git repository,
						// git will exit with a failing exit code, which will trigger the catch statement.
						// also see https://remarkablemark.org/blog/2017/10/12/check-git-dirty/#git-status
						const { stdout } = await exec('git', ['status', '--short'], {
							nodeOptions: { cwd },
							throwOnError: true
						});

						if (stdout) {
							return { success: false, message: 'Found modified files' };
						}

						return { success: true, message: undefined };
					} catch {
						return { success: true, message: 'Not a git repository' };
					}
				}
			},
			{
				name: 'supported environments',
				run: () => {
					const addersForInvalidEnvironment = adders.filter((a) => {
						const supportedEnvironments = a.environments;
						if (projectType === 'kit' && !supportedEnvironments.kit) return true;
						if (projectType === 'svelte' && !supportedEnvironments.svelte) return true;

						return false;
					});

					if (addersForInvalidEnvironment.length === 0) {
						return { success: true, message: undefined };
					}

					const messages = addersForInvalidEnvironment.map((a) => {
						if (projectType === 'kit') {
							return `'${a.id}' does not support SvelteKit`;
						} else {
							return `'${a.id}' requires SvelteKit`;
						}
					});

					throw new Error(messages.join('\n'));
				}
			}
		]
	};
}
