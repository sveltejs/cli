import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import * as find from 'empathic/find';
import { exec } from 'tinyexec';
import { Option } from 'commander';
import * as p from '@clack/prompts';
import {
	AGENTS,
	COMMANDS,
	constructCommand,
	detect,
	type AgentName
} from 'package-manager-detector';
import { parseYaml } from '@sveltejs/cli-core/parsers';

export const AGENT_NAMES = AGENTS.filter((agent): agent is AgentName => !agent.includes('@'));
const agentOptions: PackageManagerOptions = AGENT_NAMES.map((pm) => ({ value: pm, label: pm }));
agentOptions.unshift({ label: 'None', value: undefined });

export const installOption = new Option(
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
		title: `Installing dependencies with ${agent}...`,
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

		proc.process?.stdout?.on('data', (data) => {
			task.message(data.toString(), { raw: true });
		});
		proc.process?.stderr?.on('data', (data) => {
			task.message(data.toString(), { raw: true });
		});

		await proc;

		task.success('Successfully installed dependencies');
	} catch {
		task.error('Failed to install dependencies');
		p.cancel('Operation failed.');
		process.exit(2);
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

export function addPnpmBuildDependencies(
	cwd: string,
	packageManager: AgentName | null | undefined,
	allowedPackages: string[]
) {
	// other package managers are currently not affected by this change
	if (!packageManager || packageManager !== 'pnpm' || allowedPackages.length === 0) return;

	// find the workspace root (if present)
	const found = find.up('pnpm-workspace.yaml', { cwd });
	const content = found ? fs.readFileSync(found, 'utf-8') : '';

	const { data, generateCode } = parseYaml(content);

	for (const pkg of allowedPackages) {
		const onlyBuiltDependencies = data.get('onlyBuiltDependencies');
		if (onlyBuiltDependencies) {
			const values = onlyBuiltDependencies.items.map((c: { value: string }) => c.value);
			if (values.includes(pkg)) continue;

			onlyBuiltDependencies.add(pkg);
		} else {
			data.set('onlyBuiltDependencies', [pkg]);
		}
	}

	const newContent = generateCode();
	const pnpmWorkspacePath = found ?? path.join(cwd, 'pnpm-workspace.yaml');
	fs.writeFileSync(pnpmWorkspacePath, newContent);
}
