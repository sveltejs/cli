import * as p from '@clack/prompts';
import {
	type AgentName,
	color,
	resolveCommand,
	isVersionUnsupportedBelow
} from '@sveltejs/sv-utils';
import type { Argument, HelpConfiguration, Option } from 'commander';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import pkg from '../../package.json' with { type: 'json' };
import { UnsupportedError } from './errors.ts';

const NO_PREFIX = '--no-';
let options: readonly Option[] = [];

function getLongFlag(flags: string) {
	return flags
		.split(',')
		.map((f) => f.trim())
		.find((f) => f.startsWith('--'));
}

export const helpConfig: HelpConfiguration = {
	argumentDescription: formatDescription,
	optionDescription: formatDescription,
	visibleOptions(cmd) {
		// hack so that we can access existing options in `optionTerm`
		options = cmd.options;

		const visible = cmd.options.filter((o) => !o.hidden);
		const show: Option[] = [];
		// hide any `--no-` flag variants if there's an existing flag of a similar name
		// e.g. `--types` and `--no-types` will combine into a single `--[no-]types` flag
		for (const option of visible) {
			const flag = getLongFlag(option.flags);
			if (flag?.startsWith(NO_PREFIX)) {
				const stripped = flag.slice(NO_PREFIX.length);
				const isNoVariant = visible.some((o) => getLongFlag(o.flags)?.startsWith(`--${stripped}`));
				if (isNoVariant) continue;
			}
			show.push(option);
		}
		return show;
	},
	optionTerm(option) {
		const longFlag = getLongFlag(option.flags);
		const flag = longFlag?.split(' ').at(0);
		if (!flag || !longFlag) return option.flags;

		// check if there's a `--no-{flag}` variant
		const noVariant = `--no-${flag.slice(2)}`;
		const hasVariant = options.some((o) => getLongFlag(o.flags) === noVariant);
		if (hasVariant) {
			return `--[no-]${longFlag.slice(2)}`;
		}

		return option.flags;
	},
	styleCommandText: (str) => color.success(str),
	styleDescriptionText: (str) => color.optional(str)
};

function formatDescription(arg: Option | Argument): string {
	let output = arg.description;
	if (arg.defaultValue !== undefined && String(arg.defaultValue)) {
		output += color.dim(` (default: ${JSON.stringify(arg.defaultValue)})`);
	}
	if (arg.argChoices !== undefined && String(arg.argChoices)) {
		output += color.dim(` (choices: ${arg.argChoices.join(', ')})`);
	}
	return output;
}

type MaybePromise = () => Promise<void> | void;

export async function runCommand(action: MaybePromise): Promise<void> {
	try {
		p.intro(`Welcome to the Svelte CLI! ${color.optional(`(v${pkg.version})`)}`);

		const minimumVersion = '18.3.0';
		const unsupported = isVersionUnsupportedBelow(process.versions.node, minimumVersion);
		if (unsupported) {
			p.log.warn(
				`You are using Node.js ${color.error(process.versions.node)}, please upgrade to Node.js ${color.success(minimumVersion)} or higher.`
			);
		}

		await action();
		p.outro("You're all set!");
	} catch (e) {
		if (e instanceof UnsupportedError) {
			const padding = getPadding(e.reasons.map((r) => r.id));
			const message = e.reasons
				.map((r) => `  ${r.id.padEnd(padding)}  ${color.error(r.reason)}`)
				.join('\n');
			p.log.error(`${e.name}\n\n${message}`);
			p.log.message();
		} else if (e instanceof Error) {
			p.log.error(e.stack ?? String(e));
			p.log.message();
		}
		p.cancel('Operation failed.');
	}
}

export function getPadding(lines: string[]) {
	const lengths = lines.map((s) => s.length);
	return Math.max(...lengths);
}

export function forwardExitCode(error: unknown) {
	if (error && typeof error === 'object' && 'status' in error && typeof error.status === 'number') {
		process.exit(error.status);
	} else {
		process.exit(1);
	}
}

export function parseAddonOptions(optionFlags: string | undefined): string[] | undefined {
	// occurs when an `=` isn't present (e.g. `sv add foo`)
	if (optionFlags === undefined || optionFlags === '') {
		return undefined;
	}

	// Split on + and validate each option individually
	const options = optionFlags.split('+');

	// Validate that each individual option follows the name:value pattern
	const malformed = options.filter((option) => !/.+:.*/.test(option));

	if (malformed.length > 0) {
		const message = `Malformed arguments: The following add-on options: ${malformed.map((o) => `'${o}'`).join(', ')} are missing their option name or value (e.g. 'addon=option1:value1+option2:value2').`;
		throw new Error(message);
	}

	return options;
}

export function buildAndLogArgs(
	agent: AgentName | null | undefined,
	command: 'create' | 'add',
	args: string[],
	lastArgs: string[] = []
): string {
	const allArgs = [`sv@${pkg.version}`, command, ...args];

	// Handle install option
	if (agent === null || agent === undefined) allArgs.push('--no-install');
	else allArgs.push('--install', agent);

	const res = resolveCommand(agent ?? 'npm', 'execute', [...allArgs, ...lastArgs])!;
	const message = [res.command, ...res.args].join(' ');

	p.log.message(color.optional(color.dim(`To skip prompts next time, run:`)));
	p.log.info(color.optional(message), { spacing: -1 });

	return message;
}

export function updateReadme(projectPath: string, command: string) {
	const readmePath = path.join(projectPath, 'README.md');
	if (!fs.existsSync(readmePath)) return;

	let content = fs.readFileSync(readmePath, 'utf-8');

	// Check if the Creating a project section exists
	const creatingSectionPattern = /## Creating a project[\s\S]*?(?=## |$)/;
	const creatingSectionMatch = content.match(creatingSectionPattern);
	if (!creatingSectionMatch) return;

	// Append to the existing Creating a project section
	const existingSection = creatingSectionMatch[0];
	const updatedSection =
		`${existingSection.trim()}\n\n` +
		'To recreate this project with the same configuration:\n\n' +
		'```sh\n' +
		'# recreate this project\n' +
		`${command}\n` +
		'```\n\n';

	content = content.replace(creatingSectionPattern, updatedSection);
	fs.writeFileSync(readmePath, content);
}

export function errorAndExit(message: string) {
	p.log.error(message);
	p.log.message();
	p.cancel('Operation failed.');
	process.exit(1);
}

export const normalizePosix = (dir: string) => {
	return path.posix.normalize(dir.replace(/\\/g, '/'));
};
