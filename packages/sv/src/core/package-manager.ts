import * as p from '@clack/prompts';
import {
	AGENTS,
	type AgentName,
	COMMANDS,
	color,
	constructCommand,
	detect,
	isVersionUnsupportedBelow,
	parse
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

export async function addPnpmBuildDependencies(
	cwd: string,
	packageManager: AgentName | null | undefined,
	allowedPackages: string[]
): Promise<void> {
	// other package managers are currently not affected by this change
	if (!packageManager || packageManager !== 'pnpm' || allowedPackages.length === 0) return;

	let confIn: 'package.json' | 'pnpm-workspace.yaml' = 'package.json';
	const pnpmVersion = await getPnpmVersion();
	if (pnpmVersion) {
		confIn = isVersionUnsupportedBelow(pnpmVersion, '10.5')
			? 'package.json'
			: 'pnpm-workspace.yaml';
	}

	// find the workspace root (if present)
	const found = find.up('pnpm-workspace.yaml', { cwd });

	if (confIn === 'pnpm-workspace.yaml') {
		const content = found ? fs.readFileSync(found, 'utf-8') : '';
		const { data, generateCode } = parse.yaml(content);

		const onlyBuiltDependencies = data.get('onlyBuiltDependencies');
		const items: Array<{ value: string } | string> = onlyBuiltDependencies?.items ?? [];

		for (const item of allowedPackages) {
			if (items.includes(item)) continue;
			if (items.some((y) => typeof y === 'object' && y.value === item)) continue;
			items.push(item);
		}
		data.set('onlyBuiltDependencies', items);

		const newContent = generateCode();
		const pnpmWorkspacePath = found ?? path.join(cwd, 'pnpm-workspace.yaml');
		if (newContent !== content) fs.writeFileSync(pnpmWorkspacePath, newContent, 'utf-8');
	} else {
		// else is package.json (fallback)
		const rootDir = found ? path.dirname(found) : cwd;
		const pkgPath = path.join(rootDir, 'package.json');
		const content = fs.readFileSync(pkgPath, 'utf-8');
		const { data, generateCode } = parse.json(content);

		// add the packages where we install scripts should be executed
		data.pnpm ??= {};
		data.pnpm.onlyBuiltDependencies ??= [];
		for (const allowedPackage of allowedPackages) {
			if (data.pnpm.onlyBuiltDependencies.includes(allowedPackage)) continue;
			data.pnpm.onlyBuiltDependencies.push(allowedPackage);
		}

		// save the updated package.json
		const newContent = generateCode();
		if (newContent !== content) fs.writeFileSync(pkgPath, newContent, 'utf-8');
	}
}

async function getPnpmVersion(): Promise<string | undefined> {
	let v: string | undefined = undefined;
	try {
		const proc = await exec('pnpm', ['--version'], { throwOnError: true });
		v = proc.stdout.trim();
	} catch {}
	return v;
}
