import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import * as p from '@clack/prompts';
import {
	AGENTS,
	type AgentName,
	commandExists,
	color,
	detect,
	pnpm,
	resolveCommand,
	transforms,
	type TransformFn
} from '@sveltejs/sv-utils';
import { Option } from 'commander';
import * as find from 'empathic/find';
import { exec } from 'tinyexec';
import { errorAndExit } from './common.ts';

export const AGENT_NAMES: AgentName[] = AGENTS.filter(
	(agent): agent is AgentName => !agent.includes('@')
);

export const installOption: Option = new Option(
	'--install <package-manager>',
	'installs dependencies with a specified package manager'
).choices(AGENT_NAMES);

export const packageManagerOption: Option = new Option(
	'--package-manager <package-manager>',
	'package manager to use (combine with --no-install to skip installing)'
).choices(AGENT_NAMES);

export function hasInstallConflict(argv: string[]): boolean {
	return (
		argv.some((arg) => arg === '--install' || arg.startsWith('--install=')) &&
		argv.includes('--no-install')
	);
}

/** `--install <pm>` is shorthand for `--package-manager <pm>` with install on. */
export function normalizeInstallFlags<
	T extends { install: boolean | AgentName; packageManager?: AgentName }
>({
	install,
	packageManager,
	...rest
}: T): Omit<T, 'install' | 'packageManager'> & { install: boolean; packageManager?: AgentName } {
	if (typeof install === 'boolean') return { ...rest, install, packageManager };
	if (packageManager && packageManager !== install) {
		errorAndExit(
			`The ${color.command(`--install ${install}`)} and ${color.command(
				`--package-manager ${packageManager}`
			)} options cannot be used together.`
		);
	}
	return { ...rest, install: true, packageManager: install };
}

export function exitOnInstallConflict(argv: string[]): void {
	if (hasInstallConflict(argv)) {
		errorAndExit(
			`The ${color.command('--install')} and ${color.command('--no-install')} options cannot be used together.`
		);
	}
}

export async function packageManagerPrompt(cwd: string): Promise<AgentName | undefined> {
	const detected = await detect({ cwd });
	const agent = detected?.name ?? getUserAgent();

	// If we are in a non interactive environment just go with the detected package manager.
	// There is no need to prompt in that case.
	if (!process.stdout.isTTY) return agent;

	const agentOptions = [
		{ label: 'None', value: undefined },
		...AGENT_NAMES.filter(isInstalled).map((agent) => ({ value: agent }))
	];

	const pm = await p.select({
		message: 'Detected package managers. Which one should we use to install dependencies?',
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
export async function installDependencies(
	agent: AgentName,
	cwd: string,
	flags: string[] = []
): Promise<boolean> {
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

	const { command, args } = resolveCommand(agent, 'install', flags)!;

	const proc = exec(command, args, { nodeOptions: { cwd }, throwOnError: false });

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
		const report = await auditDependencies(agent, cwd);
		task.success(`Successfully installed dependencies with ${color.command(agent)}`);
		if (report) p.log.warn(report);
		return true;
	}

	if (agent === 'pnpm' && output.join('\n').includes('ERR_PNPM_IGNORED_BUILDS')) {
		const report = await auditDependencies(agent, cwd);
		task.success(`Installed dependencies with ${color.command(agent)}`);
		p.log.warn(
			`Some build scripts were skipped. Run ${color.command(`${agent} approve-builds`)} to approve them.`
		);
		if (report) p.log.warn(report);
		return true;
	}

	task.error('Failed to install dependencies');
	p.cancel('Operation failed.');
	process.exit(2);
}

/** `package-manager-detector` has no audit command, so agents with a supported equivalent are mapped here. */
const AUDIT_COMMANDS: Partial<Record<AgentName, { command: string; args: string[] }>> = {
	npm: { command: 'npm', args: ['audit'] },
	yarn: { command: 'yarn', args: ['audit'] },
	pnpm: { command: 'pnpm', args: ['audit'] },
	bun: { command: 'bun', args: ['audit'] },
	deno: { command: 'deno', args: ['audit'] }
};

/**
 * Runs the package manager's audit command and returns its report. Install logs are hidden
 * once the task log completes, which would otherwise swallow the audit report, so the caller
 * is responsible for logging it. A clean audit (and any failure, e.g. being offline) yields
 * `undefined`: the audit is best-effort and never affects the install result.
 */
export const auditDependencies = async (
	agent: AgentName,
	cwd: string
): Promise<string | undefined> => {
	const audit = AUDIT_COMMANDS[agent];
	if (!audit) return;

	const proc = exec(audit.command, audit.args, { nodeOptions: { cwd }, throwOnError: false });

	const output: string[] = [];
	try {
		for await (const line of proc) {
			output.push(line);
		}
	} catch {
		// fall through to exit-code handling below
	}

	const { exitCode = 0 } = proc;
	const report = output.join('\n').trim();

	// a clean audit is silent, anything the audit prints on a non-zero exit is reported as-is
	if (exitCode !== 0 && report) return report;
};

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

const installedCache = new Map<AgentName, boolean>();
function isInstalled(agent: AgentName): boolean {
	const cached = installedCache.get(agent);
	if (cached !== undefined) return cached;
	const installed = commandExists(agent);
	installedCache.set(agent, installed);
	return installed;
}

/**
 * `pnpm.allowBuilds` only transforms content. Add-ons get the read/write for free through
 * `sv.file`, but the CLI itself runs outside that pipeline, so it locates (or creates)
 * `pnpm-workspace.yaml` by hand.
 */
export function addAllowBuildsIfPnpm(options: ProjectOptions & { packages: string[] }): void {
	const { cwd, packageManager, packages } = options;
	if (packageManager !== 'pnpm') return;

	const filePath = find.up('pnpm-workspace.yaml', { cwd }) ?? path.join(cwd, 'pnpm-workspace.yaml');
	transformFile(filePath, pnpm.allowBuilds({ cwd, packages }));
}

type ProjectOptions = {
	cwd: string;
	packageManager: AgentName | null | undefined;
};

/** pnpm >= 10.5 reads its settings from `pnpm-workspace.yaml`, others from `.npmrc`. */
export function addEngineStrict(options: ProjectOptions): void {
	if (options.packageManager === 'pnpm' && pnpm.supportsWorkspaceSettings(options.cwd)) {
		transformFile(
			path.join(options.cwd, 'pnpm-workspace.yaml'),
			transforms.yaml(({ data }) => data.set('engineStrict', true))
		);
	} else {
		transformFile(
			path.join(options.cwd, '.npmrc'),
			transforms.text(({ content, text }) =>
				text.upsert(content, 'engine-strict', { value: 'true' })
			)
		);
	}
}

/** Missing file is treated as empty, so the transform can create it. */
function transformFile(filePath: string, transform: TransformFn): void {
	const content = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf-8') : '';
	const newContent = transform(content);
	if (newContent && newContent !== content) fs.writeFileSync(filePath, newContent, 'utf-8');
}
