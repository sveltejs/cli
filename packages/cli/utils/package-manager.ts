import process from 'node:process';
import fs from 'node:fs';
import path from 'node:path';
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

	if (agent === 'pnpm') {
		// `pnpm@10` deprecated running postinstall scripts if not
		// explicitely allowed. That's why we need to explicitely
		// allow running `kit` and `esbuild` postinstalls.
		const pkgJsonPath = path.join(cwd, 'package.json');
		const pkgJson = fs.readFileSync(pkgJsonPath, 'utf-8');
		const { data, generateCode } = parseJson(pkgJson);

		const postinstallDeps: string[] = [];
		if ('@sveltejs/kit' in data.devDependencies) {
			// only add this if we are currently executing inside a kit project
			postinstallDeps.push('@sveltejs/kit');
		}
		postinstallDeps.push('esbuild');

		data.pnpm = {
			onlyBuiltDependencies: postinstallDeps
		};
		fs.writeFileSync(pkgJsonPath, generateCode());
	}

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
