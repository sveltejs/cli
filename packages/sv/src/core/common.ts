import * as p from '@clack/prompts';
import {
	color,
	isVersionUnsupportedBelow,
	type AgentName,
	resolveCommandArray
} from '@sveltejs/sv-utils';
import type { Argument, Command, Help, HelpConfiguration, Option } from 'commander';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import pkg from '../../package.json' with { type: 'json' };
import type { LoadedAddon } from './config.ts';
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

/**
 * Returns standard help sections and a formatItem helper.
 * Used by `add` and `create` custom `formatHelp` to avoid duplicating boilerplate.
 */
export function getHelpSections(cmd: Command, helper: Help) {
	const termWidth = helper.padWidth(cmd, helper);
	const helpWidth = helper.helpWidth ?? 80;

	function formatItem(term: string, description: string) {
		return helper.formatItem(term, termWidth, description, helper);
	}

	const usage = [
		`${helper.styleTitle('Usage:')} ${helper.styleUsage(helper.commandUsage(cmd))}`,
		''
	];

	const descText = helper.commandDescription(cmd);
	const description =
		descText.length > 0
			? [helper.boxWrap(helper.styleCommandDescription(descText), helpWidth), '']
			: [];

	const argItems = helper
		.visibleArguments(cmd)
		.map((argument) =>
			formatItem(
				helper.styleArgumentTerm(helper.argumentTerm(argument)),
				helper.styleArgumentDescription(helper.argumentDescription(argument))
			)
		);
	const arguments_ = argItems.length > 0 ? [helper.styleTitle('Arguments:'), ...argItems, ''] : [];

	const optItems = helper
		.visibleOptions(cmd)
		.map((option) =>
			formatItem(
				helper.styleOptionTerm(helper.optionTerm(option)),
				helper.styleOptionDescription(helper.optionDescription(option))
			)
		);
	const options = optItems.length > 0 ? [helper.styleTitle('Options:'), ...optItems, ''] : [];

	const globalOptItems = helper.showGlobalOptions
		? helper
				.visibleGlobalOptions(cmd)
				.map((option) =>
					formatItem(
						helper.styleOptionTerm(helper.optionTerm(option)),
						helper.styleOptionDescription(helper.optionDescription(option))
					)
				)
		: [];
	const globalOptions =
		globalOptItems.length > 0 ? [helper.styleTitle('Global Options:'), ...globalOptItems, ''] : [];

	const cmdItems = helper
		.visibleCommands(cmd)
		.map((sub) =>
			formatItem(
				helper.styleSubcommandTerm(helper.subcommandTerm(sub)),
				helper.styleSubcommandDescription(helper.subcommandDescription(sub))
			)
		);
	const commands = cmdItems.length > 0 ? [helper.styleTitle('Commands:'), ...cmdItems, ''] : [];

	return {
		formatItem,
		styleTitle: helper.styleTitle.bind(helper),
		usage,
		description,
		arguments: arguments_,
		options,
		globalOptions,
		commands
	};
}

type MaybePromise = () => Promise<void> | void;

export async function runCommand(action: MaybePromise): Promise<void> {
	try {
		// Hidden hint for AI agents parsing stdout — invisible in terminal, readable in piped output
		console.log(
			color.hidden(
				'HINT: Run "sv --help" to get the full list of commands, add-ons, and examples to one-shot and skip interactive prompts.'
			)
		);

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

	const message = resolveCommandArray(agent ?? 'npm', 'execute', [...allArgs, ...lastArgs]).join(
		' '
	);

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

export function stripVersionRange(versionRange: string): string {
	// Removes the version range (e.g. `^` is removed from: `^9.0.0`)
	return versionRange.replaceAll(/[^\d|.]/g, '');
}

export function updateAgent(
	projectPath: string,
	language: 'typescript' | 'checkjs' | 'none',
	packageManager: string,
	loadedAddons: LoadedAddon[]
): void {
	const agentFiles = ['AGENTS.md', 'GEMINI.md', 'CLAUDE.md'];

	const languageLabel =
		language === 'typescript'
			? 'TypeScript'
			: language === 'checkjs'
				? 'JavaScript (JSDoc)'
				: 'None';

	const packageManagerLabel = packageManager ?? 'npm';

	const addonNames = loadedAddons.map((addon) => addon.addon.id);
	const addonsLabel = addonNames.length > 0 ? addonNames.join(', ') : 'none';

	const configSection = `## Project Configuration

- **Language**: ${languageLabel}
- **Package Manager**: ${packageManagerLabel}
- **Add-ons**: ${addonsLabel}

---

`;

	const existingSectionPattern = /^## Project Configuration[\s\S]*?---\n\n/;

	for (const fileName of agentFiles) {
		const agentPath = path.join(projectPath, fileName);
		if (!fs.existsSync(agentPath)) continue;

		let content = fs.readFileSync(agentPath, 'utf-8');
		content = content.replace(existingSectionPattern, '');
		content = configSection + content;
		fs.writeFileSync(agentPath, content);
	}
}

export const filePaths = {
	packageJson: 'package.json',
	svelteConfig: 'svelte.config.js',
	svelteConfigTS: 'svelte.config.ts',
	jsconfig: 'jsconfig.json',
	tsconfig: 'tsconfig.json',
	viteConfig: 'vite.config.js',
	viteConfigTS: 'vite.config.ts'
} as const;
