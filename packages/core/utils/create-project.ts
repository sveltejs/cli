import fs from 'node:fs';
import path from 'node:path';
import { commonFilePaths, getPackageJson } from '../files/utils';
import { createEmptyWorkspace } from '../files/workspace';

export function detectSvelteDirectory(cwd: string): string | undefined {
	if (!cwd) return;

	const packageJsonPath = path.join(cwd, commonFilePaths.packageJsonFilePath);
	const parentDirectoryPath = path.normalize(path.join(cwd, '..'));
	const isRoot = parentDirectoryPath == cwd;

	if (!isRoot && !fs.existsSync(cwd)) {
		return detectSvelteDirectory(parentDirectoryPath);
	}

	if (!isRoot && !fs.existsSync(packageJsonPath)) {
		return detectSvelteDirectory(parentDirectoryPath);
	}

	if (isRoot && !fs.existsSync(packageJsonPath)) {
		return;
	}

	const emptyWorkspace = createEmptyWorkspace();
	emptyWorkspace.cwd = cwd;
	const { data: packageJson } = getPackageJson(emptyWorkspace);

	if (packageJson.devDependencies && 'svelte' in packageJson.devDependencies) {
		return cwd;
	} else if (!isRoot) {
		return detectSvelteDirectory(parentDirectoryPath);
	}
}
