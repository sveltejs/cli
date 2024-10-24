import process from 'node:process';
import pc from 'picocolors';
import pkg from './package.json';
import { exec } from 'tinyexec';
import * as p from '@sveltejs/clack-prompts';
import { AGENTS, type AgentName, detectSync } from 'package-manager-detector';
import { COMMANDS, constructCommand, resolveCommand } from 'package-manager-detector/commands';
import type { Argument, HelpConfiguration, Option } from 'commander';
import type { AdderWithoutExplicitArgs, Precondition } from '@sveltejs/cli-core';

// partially sourced from https://github.com/tj/commander.js/blob/970ecae402b253de691e6a9066fea22f38fe7431/lib/help.js#L12
export const helpConfig: HelpConfiguration = {
	subcommandTerm: (cmd) => {
		const humanReadableArgName = (arg: Argument) => {
			const nameOutput = arg.name() + (arg.variadic === true ? '...' : '');

			return arg.required ? '<' + nameOutput + '>' : '[' + nameOutput + ']';
		};

		// Legacy. Ignores custom usage string, and nested commands.
		const args = cmd.registeredArguments.map((arg) => humanReadableArgName(arg)).join(' ');
		const aliases = cmd.aliases();
		return (
			pc.blue(cmd.name()) +
			(aliases[0] ? '|' + aliases[0] : '') +
			(cmd.options.length ? ' [options]' : '') + // simplistic check for non-help option
			(args ? ' ' + args : '')
		);
	},
	argumentTerm: (arg) => {
		return pc.blue(arg.name());
	},
	optionTerm: (option) => {
		return pc.blue(option.flags);
	},
	argumentDescription: formatDescription,
	optionDescription: formatDescription
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

export async function runCommand(action: MaybePromise) {
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
	await exec(cmd.command, cmd.args, { nodeOptions: { cwd: options.cwd, stdio: 'pipe' } });
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

export async function installDependencies(agent: AgentName, cwd: string) {
	const spinner = p.spinner();
	spinner.start('Installing dependencies...');
	try {
		const { command, args } = constructCommand(COMMANDS[agent].install, [])!;
		await exec(command, args, { nodeOptions: { cwd } });
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
						const { stdout } = await exec('git', ['status', '--short'], { nodeOptions: { cwd } });

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
