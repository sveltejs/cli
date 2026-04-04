import {
	resolveCommand as _resolveCommand,
	type Agent,
	type Command
} from 'package-manager-detector';
import {
	parseCss,
	parseHtml,
	parseJson,
	parseScript,
	parseSvelte,
	parseToml,
	parseYaml
} from './tooling/parsers.ts';

// External re-exports
export { default as dedent } from 'dedent';
export * as Walker from 'zimmerframe';
export {
	AGENTS,
	type AgentName,
	COMMANDS,
	constructCommand,
	detect,
	resolveCommand
} from 'package-manager-detector';

/** Resolves a package manager command and returns it as a string array (command + args). */
export function resolveCommandArray(agent: Agent, command: Command, args: string[]): string[] {
	const cmd = _resolveCommand(agent, command, args)!;
	return [cmd.command, ...cmd.args];
}

// Parsing & language namespaces
export * as css from './tooling/css/index.ts';
export * as js from './tooling/js/index.ts';
export * as html from './tooling/html/index.ts';
export * as text from './tooling/text.ts';
export * as json from './tooling/json.ts';
export * as svelte from './tooling/svelte/index.ts';

// Package manager helpers
export * as pnpm from './pnpm.ts';

// Transforms — sv-utils = what to do to content, sv = where and when to do it.
export { transforms } from './tooling/transforms.ts';

/**
 * Low-level parsers. Prefer `transforms` for add-on file edits — it picks the
 * right parser for you and handles `generateCode()` automatically.
 *
 * Use `parse` directly when you need error handling around parsing or
 * conditional parser selection at runtime.
 *
 * ```ts
 * import { parse } from '@sveltejs/sv-utils';
 *
 * const { ast, generateCode } = parse.script('function add(a, b) { return a + b; }');
 * const { ast, generateCode } = parse.svelte('<div>Hello, world!</div>');
 * const { ast, generateCode } = parse.css('body { color: red; }');
 * const { data, generateCode } = parse.json('{ "name": "John", "age": 30 }');
 * const { data, generateCode } = parse.yaml('name: John');
 * const { data, generateCode } = parse.toml('name = "John"');
 * const { ast, generateCode } = parse.html('<div>Hello, world!</div>');
 * ```
 */
export const parse = {
	css: parseCss as typeof parseCss,
	html: parseHtml as typeof parseHtml,
	json: parseJson as typeof parseJson,
	script: parseScript as typeof parseScript,
	svelte: parseSvelte as typeof parseSvelte,
	toml: parseToml as typeof parseToml,
	yaml: parseYaml as typeof parseYaml
};

// Utilities
export { splitVersion, isVersionUnsupportedBelow } from './common.ts';
export { createPrinter } from './utils.ts';
export { sanitizeName } from './sanitize.ts';
export { downloadJson } from './downloadJson.ts';

// File system helpers
export {
	commonFilePaths,
	fileExists,
	getPackageJson,
	readFile,
	writeFile,
	type Package
} from './files.ts';

/** @deprecated Internal to sv — will be removed from the public API in a future version. */
export { installPackages } from './files.ts';

// Terminal styling
export { color } from './color.ts';

// Types
export type { Comments, AstTypes, SvelteAst } from './tooling/index.ts';
export type { TransformFn } from './tooling/transforms.ts';
