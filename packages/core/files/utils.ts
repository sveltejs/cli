import fs from 'node:fs';
import path from 'node:path';
import { parseJson, serializeJson } from '@svelte-cli/ast-tooling';
import type { InlineAdderConfig } from '../adder/config.js';
import type { OptionDefinition } from '../adder/options.js';
import type { Workspace, WorkspaceWithoutExplicitArgs } from './workspace.js';

export type Package = {
	name: string;
	version: string;
	dependencies?: Record<string, string>;
	devDependencies?: Record<string, string>;
	bugs?: string;
	repository?: { type: string; url: string };
	keywords?: string[];
};

export function getPackageJson(workspace: WorkspaceWithoutExplicitArgs): {
	text: string;
	data: Package;
} {
	const packageText = readFile(workspace, commonFilePaths.packageJsonFilePath);
	if (!packageText) {
		return {
			text: '',
			data: {
				dependencies: {},
				devDependencies: {},
				name: '',
				version: ''
			}
		};
	}

	const packageJson = parseJson(packageText) as Package;
	return {
		text: packageText,
		data: packageJson
	};
}

export function readFile(workspace: WorkspaceWithoutExplicitArgs, filePath: string): string {
	const fullFilePath = getFilePath(workspace.cwd, filePath);

	if (!fileExistsWorkspace(workspace, filePath)) {
		return '';
	}

	const text = fs.readFileSync(fullFilePath, 'utf8');

	return text;
}

export function installPackages<Args extends OptionDefinition>(
	config: InlineAdderConfig<Args>,
	workspace: Workspace<Args>
): string {
	const { text: originalText, data } = getPackageJson(workspace);

	for (const dependency of config.packages) {
		if (dependency.condition && !dependency.condition(workspace)) {
			continue;
		}

		if (dependency.dev) {
			if (!data.devDependencies) {
				data.devDependencies = {};
			}

			data.devDependencies[dependency.name] = dependency.version;
		} else {
			if (!data.dependencies) {
				data.dependencies = {};
			}

			data.dependencies[dependency.name] = dependency.version;
		}
	}

	if (data.dependencies) data.dependencies = alphabetizeProperties(data.dependencies);
	if (data.devDependencies) data.devDependencies = alphabetizeProperties(data.devDependencies);

	writeFile(workspace, commonFilePaths.packageJsonFilePath, serializeJson(originalText, data));
	return commonFilePaths.packageJsonFilePath;
}

function alphabetizeProperties(obj: Record<string, string>) {
	const orderedObj: Record<string, string> = {};
	const sortedEntries = Object.entries(obj).sort(([a], [b]) => a.localeCompare(b));
	for (const [key, value] of sortedEntries) {
		orderedObj[key] = value;
	}
	return orderedObj;
}

export function writeFile(
	workspace: WorkspaceWithoutExplicitArgs,
	filePath: string,
	content: string
): void {
	const fullFilePath = getFilePath(workspace.cwd, filePath);
	const fullDirectoryPath = path.dirname(fullFilePath);

	if (content && !content.endsWith('\n')) content += '\n';

	if (!fs.existsSync(fullDirectoryPath)) {
		fs.mkdirSync(fullDirectoryPath, { recursive: true });
	}

	fs.writeFileSync(fullFilePath, content, 'utf8');
}

export function fileExistsWorkspace(
	workspace: WorkspaceWithoutExplicitArgs,
	filePath: string
): boolean {
	const fullFilePath = getFilePath(workspace.cwd, filePath);
	return fs.existsSync(fullFilePath);
}

export function getFilePath(cwd: string, fileName: string): string {
	return path.join(cwd, fileName);
}

export const commonFilePaths = {
	packageJsonFilePath: 'package.json',
	svelteConfigFilePath: 'svelte.config.js'
};

export function findUp(searchPath: string, fileName: string, maxDepth?: number): boolean {
	// partially sourced from https://github.com/privatenumber/get-tsconfig/blob/9e78ec52d450d58743439358dd88e2066109743f/src/utils/find-up.ts#L5
	let depth = 0;
	while (!maxDepth || depth < maxDepth) {
		const configPath = path.posix.join(searchPath, fileName);

		try {
			// `access` throws an exception if the file could not be found
			fs.accessSync(configPath);
			return true;
		} catch {
			const parentPath = path.dirname(searchPath);
			if (parentPath === searchPath) {
				// root directory
				return false;
			}

			searchPath = parentPath;
		}

		depth++;
	}

	return false;
}
