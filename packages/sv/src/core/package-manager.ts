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

export const pmOption: Option = new Option(
	'--package-manager <pm>',
	'package manager to use for installing dependencies'
).choices(AGENT_NAMES);

export const installOption: Option = new Option(
	'--install [package-manager]',
	'installs dependencies, optionally with a specified package manager (shorthand for `--install --package-manager <pm>`)'
).choices(AGENT_NAMES);

/**
 * Identifies how the user chose to handle dependency installation.
 *
 * - `unset`: no related flag was passed (or a `--install`) → per-command default behaviour (prompt when needed)
 * - `select`: `--package-manager <pm>` → the pm selection is recorded, but dependencies are never installed
 * - `install`: `--install <pm>` (shorthand for `--install --package-manager <pm>`) → install with the given pm, no prompt
 * - `no-install`: `--no-install` (or a programmatic `install: false`) → skip dependency installation
 */
export type InstallMode =
	| { kind: 'unset' }
	| { kind: 'select'; packageManager: AgentName }
	| { kind: 'install'; packageManager: AgentName }
	// installing nothing implies no package manager; left out at construction time in most cases
	| { kind: 'no-install'; packageManager: AgentName | undefined };

type InstallOptions = {
	install?: boolean | AgentName;
	packageManager?: AgentName;
};

/**
 * Exits when `--install` (any form) is combined with `--no-install`.
 *
 * Lives on the raw argv because commander collapses both flags into a single
 * `install` value (last flag wins) — the conflict is invisible at the
 * parsed-options level, so {@link parse_install_flags} cannot catch it.
 */
export function assertNoInstallConflict(argv: string[]): void {
	if (
		argv.some((arg) => arg === '--install' || arg.startsWith('--install=')) &&
		argv.includes('--no-install')
	) {
		errorAndExit(
			`The ${color.command('--install')} and ${color.command('--no-install')} options cannot be used together.`
		);
	}
}

/**
 * Parses the `--install`, `--no-install` and `--package-manager` flags into a single
 * {@link InstallMode}.
 *
 * The result may be `{ kind: 'unset' }`; call {@link resolve_unset} before it's used.
 */
export function parse_install_flags(options: InstallOptions): InstallMode {
	if (typeof options.install === 'string') {
		if (options.packageManager !== undefined) {
			errorAndExit(
				`The ${color.command('--install <package-manager>')} and ${color.command(
					'--package-manager'
				)} options cannot be used together. Use ${color.command('--install <pm>')}.`
			);
		}
		return { kind: 'install', packageManager: options.install };
	}

	if (options.install === false) {
		if (options.packageManager !== undefined) {
			p.log.warn(
				`The ${color.command('--no-install')} flag is redundant, simply call ${color.command('--package-manager <pm>')}.`
			);
			return { kind: 'select', packageManager: options.packageManager };
		}
		return { kind: 'no-install', packageManager: undefined };
	}

	if (options.packageManager !== undefined) {
		return options.install === true
			? { kind: 'install', packageManager: options.packageManager }
			: { kind: 'select', packageManager: options.packageManager };
	}

	return { kind: 'unset' };
}

/**
 * Replaces the `{ kind: 'unset' }` placeholder returned by {@link parse_install_flags}
 * with a concrete {@link InstallMode} — prompting (or falling back to detection) when
 * needed. Never returns `unset`.
 */
export async function resolve_unset(options: {
	installMode: InstallMode;
	cwd: string;
}): Promise<Exclude<InstallMode, { kind: 'unset' }>> {
	// explicitly chosen mode, it stays as-is
	switch (options.installMode.kind) {
		case 'select':
		case 'install':
		case 'no-install':
			return options.installMode;
		case 'unset':
			break;
		default:
			void (options.installMode satisfies never);
	}

	const pm = await packageManagerPrompt(options.cwd);

	return pm
		? { kind: 'install', packageManager: pm }
		: { kind: 'no-install', packageManager: undefined };
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
