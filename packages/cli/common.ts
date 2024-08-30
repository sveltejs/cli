import { spawn, type ChildProcess } from 'node:child_process';
import pc from 'picocolors';
import * as p from '@svelte-cli/clack-prompts';
import { detect } from 'package-manager-detector';
import { COMMANDS, AGENTS, type Agent } from 'package-manager-detector/agents';
import pkg from './package.json';
import type { AdderWithoutExplicitArgs } from '@svelte-cli/core';

type MaybePromise = () => Promise<void> | void;

export async function runCommand(action: MaybePromise) {
	try {
		p.intro(`Welcome to the Svelte CLI! ${pc.gray(`(v${pkg.version})`)}`);
		await action();
		p.outro("You're all set!");
	} catch (e) {
		if (e instanceof Error) {
			p.cancel(e.message);
		}
	}
}

export async function executeCli(
	command: string,
	commandArgs: string[],
	cwd: string,
	options?: {
		onData?: (data: string, program: ChildProcess, resolve: (value?: any) => any) => void;
		stdio?: 'pipe' | 'inherit';
		env?: Record<string, string>;
	}
): Promise<any> {
	const stdio = options?.stdio ?? 'pipe';
	const env = options?.env ?? process.env;

	const program = spawn(command, commandArgs, { stdio, shell: true, cwd, env });

	return await new Promise((resolve, reject) => {
		let errorText = '';
		program.stderr?.on('data', (data: Buffer) => {
			const value = data.toString();
			errorText += value;
		});

		program.stdout?.on('data', (data: Buffer) => {
			const value = data.toString();
			options?.onData?.(value, program, resolve);
		});

		program.on('exit', (code) => {
			if (code == 0) {
				resolve(undefined);
			} else {
				reject(new Error(errorText));
			}
		});
	});
}

export async function formatFiles(cwd: string, paths: string[]): Promise<void> {
	await executeCli('npx', ['prettier', '--write', '--ignore-unknown', ...paths], cwd, {
		stdio: 'pipe'
	});
}

type PMOptions = Array<{ value: Agent | undefined; label: Agent | 'None' }>;
export async function suggestInstallingDependencies(cwd: string): Promise<'installed' | 'skipped'> {
	const detectedPm = await detect({ cwd });
	let selectedPm = detectedPm.agent;

	const options: PMOptions = AGENTS.filter((agent) => !agent.includes('@')).map((pm) => ({
		value: pm,
		label: pm
	}));
	options.unshift({ label: 'None', value: undefined });

	if (!selectedPm) {
		const pm = await p.select({
			message: 'Which package manager do you want to install dependencies with?',
			options,
			initialValue: undefined
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

	const loadingSpinner = p.spinner();
	loadingSpinner.start('Installing dependencies...');

	const installCommand = COMMANDS[selectedPm].install;
	const [pm, install] = installCommand.split(' ');
	await installDependencies(pm, [install], cwd);

	loadingSpinner.stop('Successfully installed dependencies');
	return 'installed';
}

async function installDependencies(command: string, args: string[], workingDirectory: string) {
	try {
		await executeCli(command, args, workingDirectory);
	} catch (error) {
		const typedError = error as Error;
		throw new Error('unable to install dependencies: ' + typedError.message);
	}
}

export type ProjectType = 'svelte' | 'kit';

export function getGlobalPreconditions(
	cwd: string,
	projectType: ProjectType,
	adders: AdderWithoutExplicitArgs[]
) {
	return {
		name: 'global checks',
		preconditions: [
			{
				name: 'clean working directory',
				run: async () => {
					let outputText = '';

					try {
						// If a user has pending git changes the output of the following command will list
						// all files that have been added/modified/deleted and thus the output will not be empty.
						// In case the output of the command below is an empty text, we can safely assume
						// there are no pending changes. If the below command is run outside of a git repository,
						// git will exit with a failing exit code, which will trigger the catch statement.
						// also see https://remarkablemark.org/blog/2017/10/12/check-git-dirty/#git-status
						await executeCli('git', ['status', '--short'], cwd, {
							onData: (data) => {
								outputText += data;
							}
						});

						if (outputText) {
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
						const supportedEnvironments = a.config.metadata.environments;
						if (projectType === 'kit' && !supportedEnvironments.kit) return true;
						if (projectType === 'svelte' && !supportedEnvironments.svelte) return true;

						return false;
					});

					if (addersForInvalidEnvironment.length == 0) {
						return { success: true, message: undefined };
					}

					const messages = addersForInvalidEnvironment.map(
						(a) => `"${a.config.metadata.name}" does not support "${projectType}"`
					);
					return { success: false, message: messages.join(' / ') };
				}
			}
		]
	};
}
