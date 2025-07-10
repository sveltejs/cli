import pc from 'picocolors';
import pkg from '../package.json' with { type: 'json' };
import * as p from '@clack/prompts';
import type { Argument, HelpConfiguration, Option } from 'commander';
import { UnsupportedError } from './errors.ts';
import process from 'node:process';
import { minimumRequirement } from '@sveltejs/cli-core';

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
	styleTitle: (str) => pc.underline(str),
	styleCommandText: (str) => pc.red(str),
	styleDescriptionText: (str) => pc.gray(str),
	styleOptionText: (str) => pc.white(str),
	styleArgumentText: (str) => pc.white(str),
	styleSubcommandText: (str) => pc.red(str)
};

function formatDescription(arg: Option | Argument): string {
	let output = arg.description;
	if (arg.defaultValue !== undefined && String(arg.defaultValue)) {
		output += pc.dim(` (default: ${JSON.stringify(arg.defaultValue)})`);
	}
	if (arg.argChoices !== undefined && String(arg.argChoices)) {
		output += pc.dim(` (choices: ${arg.argChoices.join(', ')})`);
	}
	return output;
}

type MaybePromise = () => Promise<void> | void;

export async function runCommand(action: MaybePromise): Promise<void> {
	try {
		p.intro(`Welcome to the Svelte CLI! ${pc.gray(`(v${pkg.version})`)}`);

		const unsupported = minimumRequirement('18.3').for(process.versions.node);
		if (unsupported) {
			p.log.warn(
				`You are using Node.js ${pc.red(process.versions.node)}, please upgrade to Node.js 18.3 or higher.`
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
