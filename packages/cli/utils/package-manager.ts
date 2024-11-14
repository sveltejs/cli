import process from 'node:process';
import { exec, NonZeroExitError } from 'tinyexec';
import * as p from '@sveltejs/clack-prompts';
import {
	AGENTS,
	COMMANDS,
	constructCommand,
	detectSync,
	type AgentName
} from 'package-manager-detector';

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

		if (error instanceof NonZeroExitError) {
			const stderr = error.output?.stderr;
			if (stderr) p.log.error(stderr);
		}

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
