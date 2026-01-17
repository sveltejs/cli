/** @import { AgentName } from 'package-manager-detector' */
/** @import { Workspace } from '../../core.js' */
import * as p from '@clack/prompts';
import fs from 'node:fs';
import path from 'node:path';
import { resolveCommand } from 'package-manager-detector';
import pc from 'picocolors';
import { exec } from 'tinyexec';

import { parse } from '../../core.js';

/**
 * @typedef {{
 *   name: string;
 *   version: string;
 *   dependencies?: Record<string, string>;
 *   devDependencies?: Record<string, string>;
 *   bugs?: string;
 *   repository?: { type: string; url: string };
 *   keywords?: string[];
 *   workspaces?: string[];
 * }} Package
 */

/**
 * @param {string} cwd
 * @returns {{ source: string; data: Package; generateCode: () => string }}
 */
export function getPackageJson(cwd) {
	const packageText = readFile(cwd, commonFilePaths.packageJson);
	if (!packageText) {
		const pkgPath = path.join(cwd, commonFilePaths.packageJson);
		throw new Error(`Invalid workspace: missing '${pkgPath}'`);
	}

	const { data, generateCode } = parse.json(packageText);
	return { source: packageText, data: /** @type {Package} */ (data), generateCode };
}

/**
 * @param {{ packageManager: AgentName; cwd: string; filesToFormat: string[] }} options
 * @returns {Promise<void>}
 */
export async function formatFiles(options) {
	if (options.filesToFormat.length === 0) return;
	const { start, stop } = p.spinner();
	start('Formatting modified files');

	const args = ['prettier', '--write', '--ignore-unknown', ...options.filesToFormat];
	const cmd = resolveCommand(options.packageManager, 'execute-local', args);
	if (!cmd) {
		stop('Failed to format files');
		p.log.error('Failed to resolve prettier command');
		return;
	}

	try {
		const result = await exec(cmd.command, cmd.args, {
			nodeOptions: { cwd: options.cwd, stdio: 'pipe' },
			throwOnError: true
		});
		if (result.exitCode !== 0) {
			stop('Failed to format files');
			p.log.error(result.stderr);
			return;
		}
	} catch (e) {
		stop('Failed to format files');
		// @ts-expect-error
		p.log.error(e?.output?.stderr || 'unknown error');
		return;
	}
	stop('Successfully formatted modified files');
}

/**
 * @param {string} cwd
 * @param {string} filePath
 * @returns {string}
 */
export function readFile(cwd, filePath) {
	const fullFilePath = path.resolve(cwd, filePath);

	if (!fileExists(cwd, filePath)) {
		return '';
	}

	const text = fs.readFileSync(fullFilePath, 'utf8');

	return text;
}

/**
 * @param {Array<{ pkg: string; version: string; dev: boolean }>} dependencies
 * @param {Workspace} workspace
 * @returns {string}
 */
export function installPackages(dependencies, workspace) {
	const { data, generateCode } = getPackageJson(workspace.cwd);

	for (const dependency of dependencies) {
		if (dependency.dev) {
			data.devDependencies ??= {};
			data.devDependencies[dependency.pkg] = dependency.version;
		} else {
			data.dependencies ??= {};
			data.dependencies[dependency.pkg] = dependency.version;
		}
	}

	if (data.dependencies) data.dependencies = alphabetizeProperties(data.dependencies);
	if (data.devDependencies) data.devDependencies = alphabetizeProperties(data.devDependencies);

	writeFile(workspace, commonFilePaths.packageJson, generateCode());
	return commonFilePaths.packageJson;
}

/**
 * @param {Record<string, string>} obj
 * @returns {Record<string, string>}
 */
function alphabetizeProperties(obj) {
	/** @type {Record<string, string>} */
	const orderedObj = {};
	const sortedEntries = Object.entries(obj).sort(([a], [b]) => a.localeCompare(b));
	for (const [key, value] of sortedEntries) {
		orderedObj[key] = value;
	}
	return orderedObj;
}

/**
 * @param {Workspace} workspace
 * @param {string} filePath
 * @param {string} content
 * @returns {void}
 */
export function writeFile(workspace, filePath, content) {
	const fullFilePath = path.resolve(workspace.cwd, filePath);
	const fullDirectoryPath = path.dirname(fullFilePath);

	if (content && !content.endsWith('\n')) content += '\n';

	if (!fs.existsSync(fullDirectoryPath)) {
		fs.mkdirSync(fullDirectoryPath, { recursive: true });
	}

	fs.writeFileSync(fullFilePath, content, 'utf8');
}

/**
 * @param {string} cwd
 * @param {string} filePath
 * @returns {boolean}
 */
export function fileExists(cwd, filePath) {
	const fullFilePath = path.resolve(cwd, filePath);
	return fs.existsSync(fullFilePath);
}

export const commonFilePaths = /** @type {const} */ ({
	packageJson: 'package.json',
	svelteConfig: 'svelte.config.js',
	svelteConfigTS: 'svelte.config.ts',
	jsconfig: 'jsconfig.json',
	tsconfig: 'tsconfig.json',
	viteConfig: 'vite.config.js',
	viteConfigTS: 'vite.config.ts'
});

export const color = {
	/** @param {string} str */
	addon: (str) => pc.green(str),
	/** @param {string} str */
	command: (str) => pc.bold(pc.cyanBright(str)),
	/** @param {string} str */
	env: (str) => pc.yellow(str),
	/** @param {string} str */
	path: (str) => pc.green(str),
	/** @param {string} str */
	route: (str) => pc.bold(str),
	/** @param {string} str */
	website: (str) => pc.cyan(str),
	/** @param {string} str */
	optional: (str) => pc.gray(str),
	/** @param {string} str */
	warning: (str) => pc.yellow(str)
};
