import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { exec } from 'tinyexec';
import * as p from '@sveltejs/clack-prompts';
import {
	AGENTS,
	COMMANDS,
	constructCommand,
	detectSync,
	type AgentName
} from 'package-manager-detector';
import { parseJson } from '@sveltejs/cli-core/parsers';

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
	const task = p.taskLog(`Installing dependencies with ${agent}...`);

	try {
		const { command, args } = constructCommand(COMMANDS[agent].install, [])!;
		const proc = exec(command, args, {
			nodeOptions: { cwd, stdio: 'pipe' },
			throwOnError: true
		});

		proc.process?.stdout?.on('data', (data) => {
			task.text = data;
		});
		proc.process?.stderr?.on('data', (data) => {
			task.text = data;
		});

		await proc;

		task.success('Successfully installed dependencies');
	} catch {
		task.fail('Failed to install dependencies');
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

export function allowExecutingPostinstallScripts(
	cwd: string,
	packageManager: AgentName | null | undefined,
	allowedPackages: string[]
) {
	// currently we only need to explicitly allow running postinstall
	// scripts for pnpm. It's possible that this sets precedence for
	// other package managers tho, therefore this has been extracted here.
	if (!packageManager || packageManager !== 'pnpm') return;

	const pkgPath = path.join(cwd, 'package.json');
	const content = fs.readFileSync(pkgPath, 'utf-8');
	const { data, generateCode } = parseJson(content);

	data.pnpm ??= {};
	data.pnpm.onlyBuiltDependencies ??= [];
	for (const allowedPackage of allowedPackages) {
		if (data.pnpm.onlyBuiltDependencies.includes(allowedPackage)) continue;
		data.pnpm.onlyBuiltDependencies.push(allowedPackage);
	}

	const newContent = generateCode();
	fs.writeFileSync(pkgPath, newContent);
}
