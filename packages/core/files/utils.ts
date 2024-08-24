import fs from 'node:fs';
import path from 'node:path';
import { executeCli } from '../utils/cli';
import type { WorkspaceWithoutExplicitArgs } from '../utils/workspace';

export function readFile(workspace: WorkspaceWithoutExplicitArgs, filePath: string): string {
	const fullFilePath = getFilePath(workspace.cwd, filePath);

	if (!fileExistsWorkspace(workspace, filePath)) {
		return '';
	}

	const text = fs.readFileSync(fullFilePath, 'utf8');

	return text;
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

export async function format(
	workspace: WorkspaceWithoutExplicitArgs,
	paths: string[]
): Promise<void> {
	await executeCli('npx', ['prettier', '--write', '--ignore-unknown', ...paths], workspace.cwd, {
		stdio: 'pipe'
	});
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
