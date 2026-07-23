import * as p from '@clack/prompts';
import {
	AGENTS,
	type AgentName,
	COMMANDS,
	color,
	constructCommand,
	detect,
	pnpm
} from '@sveltejs/sv-utils';
import { Option } from 'commander';
import * as find from 'empathic/find';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { exec, execSync } from 'tinyexec';

export const AGENT_NAMES: AgentName[] = AGENTS.filter(
	(agent): agent is AgentName => !agent.includes('@')
);

export const installOption: Option = new Option(
	'--install <package-manager>',
	'installs dependencies with a specified package manager'
).choices(AGENT_NAMES);

export async function packageManagerPrompt(cwd: string): Promise<AgentName | undefined> {
	const detected = await detect({ cwd });
	const detectedAgent = detected?.name ?? getUserAgent();
	const installedAgents = AGENT_NAMES.filter(isInstalled);
	const agent = detectedAgent ?? installedAgents[0];

	const agentOptions = [
		{ label: 'None', value: undefined },
		...AGENT_NAMES.map((agent) => {
			const installed = installedAgents.includes(agent);
			return {
				value: agent,
				label: installed ? agent : color.dim(`${agent} (not installed)`),
				installed
			};
			// installed ones first
		}).sort((a, b) => Number(b.installed) - Number(a.installed))
	];

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

/** Returns `false` when the package manager isn't installed and the install was skipped. */
export async function installDependencies(agent: AgentName, cwd: string): Promise<boolean> {
	if (!isInstalled(agent)) {
		p.log.warn(`${color.command(agent)} is not installed, skipping dependency installation.`);
		return false;
	}

	const task = p.taskLog({
		title: `Installing dependencies with ${color.command(agent)}...`,
		limit: Math.ceil(process.stdout.rows / 2),
		spacing: 0,
		retainLog: true
	});

	const { command, args } = constructCommand(COMMANDS[agent].install, [])!;

	const proc = exec(command, args, {
		nodeOptions: { cwd, stdio: 'pipe' },
		throwOnError: false
	});

	const output: string[] = [];
	try {
		for await (const line of proc) {
			// line will be from stderr/stdout in the order you'd see it in a term
			output.push(line);
			task.message(line);
		}
	} catch {
		// fall through to exit-code handling below
	}

	const exitCode = proc.exitCode ?? 0;
	if (exitCode === 0) {
		task.success(`Successfully installed dependencies with ${color.command(agent)}`);
		return true;
	}

	if (agent === 'pnpm' && output.join('\n').includes('ERR_PNPM_IGNORED_BUILDS')) {
		task.success(`Installed dependencies with ${color.command(agent)}`);
		p.log.warn(
			`Some build scripts were skipped. Run ${color.command(`${agent} approve-builds`)} to approve them.`
		);
		return true;
	}

	task.error('Failed to install dependencies');
	p.cancel('Operation failed.');
	process.exit(2);
}

export async function detectPackageManager(cwd: string): Promise<AgentName> {
	const detected = await detect({ cwd });
	return detected?.name ?? getUserAgent() ?? 'npm';
}

function getUserAgent(): AgentName | undefined {
	const userAgent = process.env.npm_config_user_agent;
	if (!userAgent) return undefined;

	const pmSpec = userAgent.split(' ')[0]!;
	const separatorPos = pmSpec.lastIndexOf('/');
	const name = pmSpec.substring(0, separatorPos) as AgentName;
	return AGENTS.includes(name) ? name : undefined;
}

function isInstalled(agent: AgentName): boolean {
	try {
		execSync(agent, ['--version'], { nodeOptions: { stdio: 'ignore' } });
		return true;
	} catch {
		return false;
	}
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
	const newContent = pnpm.allowBuilds(...packages)(content);
	if (newContent !== content) fs.writeFileSync(filePath, newContent, 'utf-8');
}
