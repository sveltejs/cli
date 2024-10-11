import fs from 'node:fs';
import path from 'node:path';
import pc from 'picocolors';
import { parseJson } from '@svelte-cli/core/parsers';
import type { Adder, Highlighter, Workspace } from '@svelte-cli/core';

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

export function getPackageJson(cwd: string) {
	const packageText = readFile(cwd, commonFilePaths.packageJson);
	if (!packageText) {
		const pkgPath = path.join(cwd, commonFilePaths.packageJson);
		throw new Error(`Invalid workspace: missing '${pkgPath}'`);
	}

	const { data, generateCode } = parseJson(packageText);
	return { source: packageText, data: data as Package, generateCode };
}

export function readFile(cwd: string, filePath: string): string {
	const fullFilePath = getFilePath(cwd, filePath);

	if (!fileExists(cwd, filePath)) {
		return '';
	}

	const text = fs.readFileSync(fullFilePath, 'utf8');

	return text;
}

export function installPackages(config: Adder<any>, workspace: Workspace<any>): string {
	const { data, generateCode } = getPackageJson(workspace.cwd);

	for (const dependency of config.packages) {
		if (dependency.condition && !dependency.condition(workspace)) {
			continue;
		}

		if (dependency.dev) {
			data.devDependencies ??= {};
			data.devDependencies[dependency.name] = dependency.version;
		} else {
			data.dependencies ??= {};
			data.dependencies[dependency.name] = dependency.version;
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

export function writeFile(workspace: Workspace<any>, filePath: string, content: string): void {
	const fullFilePath = getFilePath(workspace.cwd, filePath);
	const fullDirectoryPath = path.dirname(fullFilePath);

	if (content && !content.endsWith('\n')) content += '\n';

	if (!fs.existsSync(fullDirectoryPath)) {
		fs.mkdirSync(fullDirectoryPath, { recursive: true });
	}

	fs.writeFileSync(fullFilePath, content, 'utf8');
}

export function fileExists(cwd: string, filePath: string): boolean {
	const fullFilePath = getFilePath(cwd, filePath);
	return fs.existsSync(fullFilePath);
}

export function getFilePath(cwd: string, fileName: string): string {
	return path.join(cwd, fileName);
}

export const commonFilePaths = {
	packageJson: 'package.json',
	svelteConfig: 'svelte.config.js',
	tsconfig: 'tsconfig.json',
	viteConfigTS: 'vite.config.ts'
} as const;

export function getHighlighter(): Highlighter {
	return {
		command: (str) => pc.bold(pc.cyanBright(str)),
		env: (str) => pc.yellow(str),
		path: (str) => pc.green(str),
		route: (str) => pc.bold(str),
		website: (str) => pc.whiteBright(str)
	};
}
