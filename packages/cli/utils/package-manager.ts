import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import * as find from 'empathic/find';
import { exec } from 'tinyexec';
import * as p from '@clack/prompts';
import {
	AGENTS,
	COMMANDS,
	constructCommand,
	detect,
	type AgentName
} from 'package-manager-detector';
import { parseJson } from '@sveltejs/cli-core/parsers';

const agents = AGENTS.filter((agent): agent is AgentName => !agent.includes('@'));
const agentOptions: PackageManagerOptions = agents.map((pm) => ({ value: pm, label: pm }));
agentOptions.unshift({ label: 'None', value: undefined });

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
		message: `Installing dependencies with ${agent}...`,
		limit: 5
	});

	try {
		const { command, args } = constructCommand(COMMANDS[agent].install, [])!;
		const proc = exec(command, args, {
			nodeOptions: { cwd, stdio: 'pipe' },
			throwOnError: true
		});

		proc.process?.stdout?.on('data', (data) => {
			task.message(data);
		});
		proc.process?.stderr?.on('data', (data) => {
			task.message(data);
		});

		await proc;

		task.success('Successfully installed dependencies');
	} catch (error) {
		task.error('Failed to install dependencies' + error);
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

export function addPnpmBuildDependendencies(
	cwd: string,
	packageManager: AgentName | null | undefined,
	allowedPackages: string[]
) {
	// other package managers are currently not affected by this change
	if (!packageManager || packageManager !== 'pnpm') return;

	// find the workspace root (if present)
	const pnpmWorkspacePath = find.up('pnpm-workspace.yaml', { cwd });
	let packageDirectory;

	if (pnpmWorkspacePath) packageDirectory = path.dirname(pnpmWorkspacePath);
	else packageDirectory = cwd;

	// load the package.json
	const pkgPath = path.join(packageDirectory, 'package.json');
	const content = fs.readFileSync(pkgPath, 'utf-8');
	const { data, generateCode } = parseJson(content);

	// add the packages where we install scripts should be executed
	data.pnpm ??= {};
	data.pnpm.onlyBuiltDependencies ??= [];
	for (const allowedPackage of allowedPackages) {
		if (data.pnpm.onlyBuiltDependencies.includes(allowedPackage)) continue;
		data.pnpm.onlyBuiltDependencies.push(allowedPackage);
	}

	// save the updated package.json
	const newContent = generateCode();
	fs.writeFileSync(pkgPath, newContent);
}
