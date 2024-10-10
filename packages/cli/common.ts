import process from 'node:process';
import pc from 'picocolors';
import pkg from './package.json';
import { exec } from 'tinyexec';
import * as p from '@svelte-cli/clack-prompts';
import { detect, AGENTS, type AgentName } from 'package-manager-detector';
import { COMMANDS, constructCommand, resolveCommand } from 'package-manager-detector/commands';
import type { Argument, HelpConfiguration, Option } from 'commander';
import type { AdderWithoutExplicitArgs, Precondition } from '@svelte-cli/core';
import { detectPackageManager, getUserAgent } from '@svelte-cli/core/internal';

export const helpConfig: HelpConfiguration = {
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

export let packageManager: AgentName | undefined;

export async function runCommand(action: MaybePromise) {
	try {
		p.intro(`Welcome to the Svelte CLI! ${pc.gray(`(v${pkg.version})`)}`);
		await action();
		p.outro("You're all set!");
	} catch (e) {
		p.cancel('Operation failed.');
		if (e instanceof Error) {
			console.error(e.message);
		}
	}
}

export async function formatFiles(cwd: string, paths: string[]): Promise<void> {
	const pm = detectPackageManager(cwd);
	const args = ['prettier', '--write', '--ignore-unknown', ...paths];
	const cmd = resolveCommand(pm, 'execute-local', args)!;
	await exec(cmd.command, cmd.args, {
		nodeOptions: { cwd, stdio: 'pipe' }
	});
}

type PackageManagerOptions = Array<{ value: AgentName | null; label: AgentName | 'None' }>;
export async function suggestInstallingDependencies(cwd: string): Promise<'installed' | 'skipped'> {
	const detectedPm = await detect({ cwd });
	let selectedPm = detectedPm?.agent ?? null;

	const agents = AGENTS.filter((agent): agent is AgentName => !agent.includes('@'));
	const options: PackageManagerOptions = agents.map((pm) => ({ value: pm, label: pm }));
	options.unshift({ label: 'None', value: null });

	if (!selectedPm) {
		const pm = await p.select({
			message: 'Which package manager do you want to install dependencies with?',
			options,
			initialValue: getUserAgent()
		});
		if (p.isCancel(pm)) {
			p.cancel('Operation cancelled.');
			process.exit(1);
		}

		selectedPm = pm;
	}

	if (!selectedPm || !COMMANDS[selectedPm]) {
		return 'skipped';
	}

	const { command, args } = constructCommand(COMMANDS[selectedPm].install, [])!;

	const loadingSpinner = p.spinner();
	loadingSpinner.start('Installing dependencies...');

	await installDependencies(command, args, cwd);

	packageManager = command as AgentName;

	loadingSpinner.stop('Successfully installed dependencies');
	return 'installed';
}

async function installDependencies(command: string, args: string[], cwd: string) {
	try {
		await exec(command, args, { nodeOptions: { cwd } });
	} catch (error) {
		const typedError = error as Error;
		throw new Error(`Unable to install dependencies: ${typedError.message}`);
	}
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
						const supportedEnvironments = a.metadata.environments;
						if (projectType === 'kit' && !supportedEnvironments.kit) return true;
						if (projectType === 'svelte' && !supportedEnvironments.svelte) return true;

						return false;
					});

					if (addersForInvalidEnvironment.length == 0) {
						return { success: true, message: undefined };
					}

					const messages = addersForInvalidEnvironment.map(
						(a) => `"${a.metadata.name}" does not support "${projectType}"`
					);
					return { success: false, message: messages.join(' / ') };
				}
			}
		]
	};
}
