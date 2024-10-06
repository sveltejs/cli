import fs from 'node:fs';
import path from 'node:path';
import { parseJson, serializeJson } from '@svelte-cli/ast-tooling';
import type { AdderConfig } from '../adder/config.ts';
import type { OptionDefinition } from '../adder/options.ts';
import type { Workspace, WorkspaceWithoutExplicitArgs } from './workspace.ts';

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
	const packageText = readFile(workspace, commonFilePaths.packageJson);
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
	config: AdderConfig<Args>,
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

	writeFile(workspace, commonFilePaths.packageJson, serializeJson(originalText, data));
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
	packageJson: 'package.json',
	svelteConfig: 'svelte.config.js',
	tsconfig: 'tsconfig.json',
	viteConfigTS: 'vite.config.ts'
} as const;
