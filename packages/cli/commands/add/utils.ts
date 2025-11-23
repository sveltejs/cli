import fs from 'node:fs';
import path from 'node:path';
import pc from 'picocolors';
import { exec } from 'tinyexec';
import { parseJson } from '@sveltejs/cli-core/parsers';
import { resolveCommand, type AgentName } from 'package-manager-detector';
import type { Highlighter, Workspace } from '@sveltejs/cli-core';

export type Package = {
	name: string;
	version: string;
	dependencies?: Record<string, string>;
	devDependencies?: Record<string, string>;
	bugs?: string;
	repository?: { type: string; url: string };
	keywords?: string[];
	workspaces?: string[];
};

export function getPackageJson(cwd: string): {
	source: string;
	data: Package;
	generateCode: () => string;
} {
	const packageText = readFile(cwd, commonFilePaths.packageJson);
	if (!packageText) {
		const pkgPath = path.join(cwd, commonFilePaths.packageJson);
		throw new Error(`Invalid workspace: missing '${pkgPath}'`);
	}

	const { data, generateCode } = parseJson(packageText);
	return { source: packageText, data: data as Package, generateCode };
}

export async function formatFiles(options: {
	packageManager: AgentName;
	cwd: string;
	paths: string[];
}): Promise<void> {
	const args = ['prettier', '--write', '--ignore-unknown', ...options.paths];
	const cmd = resolveCommand(options.packageManager, 'execute-local', args)!;
	await exec(cmd.command, cmd.args, {
		nodeOptions: { cwd: options.cwd, stdio: 'pipe' },
		throwOnError: true
	});
}

export function readFile(cwd: string, filePath: string): string {
	const fullFilePath = path.resolve(cwd, filePath);

	if (!fileExists(cwd, filePath)) {
		return '';
	}

	const text = fs.readFileSync(fullFilePath, 'utf8');

	return text;
}

export function installPackages(
	dependencies: Array<{ pkg: string; version: string; dev: boolean }>,
	workspace: Workspace
): string {
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

function alphabetizeProperties(obj: Record<string, string>) {
	const orderedObj: Record<string, string> = {};
	const sortedEntries = Object.entries(obj).sort(([a], [b]) => a.localeCompare(b));
	for (const [key, value] of sortedEntries) {
		orderedObj[key] = value;
	}
	return orderedObj;
}

export function writeFile(workspace: Workspace, filePath: string, content: string): void {
	const fullFilePath = path.resolve(workspace.cwd, filePath);
	const fullDirectoryPath = path.dirname(fullFilePath);

	if (content && !content.endsWith('\n')) content += '\n';

	if (!fs.existsSync(fullDirectoryPath)) {
		fs.mkdirSync(fullDirectoryPath, { recursive: true });
	}

	fs.writeFileSync(fullFilePath, content, 'utf8');
}

export function fileExists(cwd: string, filePath: string): boolean {
	const fullFilePath = path.resolve(cwd, filePath);
	return fs.existsSync(fullFilePath);
}

export const commonFilePaths = {
	packageJson: 'package.json',
	svelteConfig: 'svelte.config.js',
	svelteConfigTS: 'svelte.config.ts',
	jsConfig: 'jsconfig.json',
	tsConfig: 'tsconfig.json',
	viteConfig: 'vite.config.js',
	viteConfigTS: 'vite.config.ts'
} as const;

export function getHighlighter(): Highlighter {
	return {
		addon: (str) => pc.green(str),
		command: (str) => pc.bold(pc.cyanBright(str)),
		env: (str) => pc.yellow(str),
		path: (str) => pc.green(str),
		route: (str) => pc.bold(str),
		website: (str) => pc.whiteBright(str),
		optional: (str) => pc.gray(str)
	};
}
