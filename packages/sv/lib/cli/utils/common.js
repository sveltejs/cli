/** @import { Argument, HelpConfiguration, Option } from 'commander' */
/** @import { AgentName } from 'package-manager-detector' */
import pc from 'picocolors';
import fs from 'node:fs';
import path from 'node:path';
import pkg from '../../../package.json' with { type: 'json' };
import * as p from '@clack/prompts';
import process from 'node:process';
import { resolveCommand } from 'package-manager-detector';

import { isVersionUnsupportedBelow } from '../../core.js';
import { UnsupportedError } from './errors.js';

const NO_PREFIX = '--no-';
/** @type {readonly Option[]} */
let options = [];

/**
 * @param {string} flags
 * @returns {string | undefined}
 */
function getLongFlag(flags) {
	return flags
		.split(',')
		.map((f) => f.trim())
		.find((f) => f.startsWith('--'));
}

/**
 * @param {Option | Argument} arg
 * @returns {string}
 */
function formatDescription(arg) {
	let output = arg.description;
	if (arg.defaultValue !== undefined && String(arg.defaultValue)) {
		output += pc.dim(` (default: ${JSON.stringify(arg.defaultValue)})`);
	}
	if (arg.argChoices !== undefined && String(arg.argChoices)) {
		output += pc.dim(` (choices: ${arg.argChoices.join(', ')})`);
	}
	return output;
}

/** @type {HelpConfiguration} */
export const helpConfig = {
	argumentDescription: formatDescription,
	optionDescription: formatDescription,
	visibleOptions(cmd) {
		// hack so that we can access existing options in `optionTerm`
		options = cmd.options;

		const visible = cmd.options.filter((o) => !o.hidden);
		/** @type {Option[]} */
		const show = [];
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
	styleTitle: (str) => pc.underline(str),
	styleCommandText: (str) => pc.red(str),
	styleDescriptionText: (str) => pc.gray(str),
	styleOptionText: (str) => pc.white(str),
	styleArgumentText: (str) => pc.white(str),
	styleSubcommandText: (str) => pc.red(str)
};

/**
 * @param {() => Promise<void> | void} action
 * @returns {Promise<void>}
 */
export async function runCommand(action) {
	try {
		p.intro(`Welcome to the Svelte CLI! ${pc.gray(`(v${pkg.version})`)}`);

		const minimumVersion = '18.3.0';
		const unsupported = isVersionUnsupportedBelow(process.versions.node, minimumVersion);
		if (unsupported) {
			p.log.warn(
				`You are using Node.js ${pc.red(process.versions.node)}, please upgrade to Node.js ${pc.green(minimumVersion)} or higher.`
			);
		}

		await action();
		p.outro("You're all set!");
	} catch (e) {
		if (e instanceof UnsupportedError) {
			const padding = getPadding(e.reasons.map((r) => r.id));
			const message = e.reasons
				.map((r) => `  ${r.id.padEnd(padding)}  ${pc.red(r.reason)}`)
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

/**
 * @param {string[]} lines
 * @returns {number}
 */
export function getPadding(lines) {
	const lengths = lines.map((s) => s.length);
	return Math.max(...lengths);
}

/**
 * @param {unknown} error
 * @returns {never}
 */
export function forwardExitCode(error) {
	if (error && typeof error === 'object' && 'status' in error && typeof error.status === 'number') {
		process.exit(error.status);
	} else {
		process.exit(1);
	}
}

/**
 * @param {string | undefined} optionFlags
 * @returns {string[] | undefined}
 */
export function parseAddonOptions(optionFlags) {
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

/**
 * @param {AgentName | null | undefined} agent
 * @param {'create' | 'add'} command
 * @param {string[]} args
 * @param {string[]} [lastArgs]
 * @returns {string}
 */
export function buildAndLogArgs(agent, command, args, lastArgs = []) {
	const allArgs = ['sv', command, ...args];

	// Handle install option
	if (agent === null || agent === undefined) allArgs.push('--no-install');
	else allArgs.push('--install', agent);

	const res = resolveCommand(agent ?? 'npm', 'execute', [...allArgs, ...lastArgs]);
	if (!res) throw new Error('Failed to resolve command');
	const message = [res.command, ...res.args].join(' ');

	p.log.info(pc.dim(`Re-run without prompts:\n${message}`));

	return message;
}

/**
 * @param {string} projectPath
 * @param {string} command
 * @returns {void}
 */
export function updateReadme(projectPath, command) {
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

/**
 * @param {string} message
 * @returns {never}
 */
export function errorAndExit(message) {
	p.log.error(message);
	p.log.message();
	p.cancel('Operation failed.');
	process.exit(1);
}

/**
 * @param {string} dir
 * @returns {string}
 */
export const normalizePosix = (dir) => {
	return path.posix.normalize(dir.replace(/\\/g, '/'));
};
