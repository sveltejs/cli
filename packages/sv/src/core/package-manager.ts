import * as p from '@clack/prompts';
import {
	AGENTS,
	type AgentName,
	COMMANDS,
	allowBuilds,
	color,
	constructCommand,
	detect
} from '@sveltejs/sv-utils';
import { Option } from 'commander';
import * as find from 'empathic/find';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { exec } from 'tinyexec';

export const AGENT_NAMES: AgentName[] = AGENTS.filter(
	(agent): agent is AgentName => !agent.includes('@')
);
const agentOptions: PackageManagerOptions = AGENT_NAMES.map((pm) => ({ value: pm, label: pm }));
agentOptions.unshift({ label: 'None', value: undefined });

export const installOption: Option = new Option(
	'--install <package-manager>',
	'installs dependencies with a specified package manager'
).choices(AGENT_NAMES);

type PackageManagerOptions = Array<{ value: AgentName | undefined; label: AgentName | 'None' }>;
export async function packageManagerPrompt(cwd: string): Promise<AgentName | undefined> {
	const detected = await detect({ cwd });
	const agent = detected?.name ?? getUserAgent();

	// If we are in a non interactive environment just go with the detected package manager.
	// There is no need to prompt in that case.
	if (!process.stdout.isTTY) return agent;

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
	const task = p.taskLog({
		title: `Installing dependencies with ${color.command(agent)}...`,
		limit: Math.ceil(process.stdout.rows / 2),
		spacing: 0,
		retainLog: true
	});

	try {
		const { command, args } = constructCommand(COMMANDS[agent].install, [])!;

		const proc = exec(command, args, {
			nodeOptions: { cwd, stdio: 'pipe' },
			throwOnError: true
		});

		for await (const line of proc) {
			// line will be from stderr/stdout in the order you'd see it in a term
			task.message(line);
		}

		task.success(`Successfully installed dependencies with ${color.command(agent)}`);
	} catch {
		task.error('Failed to install dependencies');
		p.cancel('Operation failed.');
		process.exit(2);
	}
}

export async function detectPackageManager(cwd: string): Promise<AgentName> {
	const detected = await detect({ cwd });
	return detected?.name ?? getUserAgent() ?? 'npm';
}

export function getUserAgent(): AgentName | undefined {
	const userAgent = process.env.npm_config_user_agent;
	if (!userAgent) return undefined;

	const pmSpec = userAgent.split(' ')[0]!;
	const separatorPos = pmSpec.lastIndexOf('/');
	const name = pmSpec.substring(0, separatorPos) as AgentName;
	return AGENTS.includes(name) ? name : undefined;
}

export function addPnpmAllowBuilds(
	cwd: string,
	packageManager: AgentName | null | undefined,
	...packages: string[]
): void {
	if (packageManager !== 'pnpm' || packages.length === 0) return;

	const found = find.up('pnpm-workspace.yaml', { cwd });
	const filePath = found ?? path.join(cwd, 'pnpm-workspace.yaml');
	const content = found ? fs.readFileSync(found, 'utf-8') : '';
	const newContent = allowBuilds(...packages)(content);
	if (newContent !== content) fs.writeFileSync(filePath, newContent, 'utf-8');
}
