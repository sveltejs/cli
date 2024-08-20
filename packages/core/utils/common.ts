import { parseJson } from '@svelte-cli/ast-tooling';
import { commonFilePaths, readFile } from '../files/utils';
import type { WorkspaceWithoutExplicitArgs } from './workspace';

export type Package = {
	name: string;
	version: string;
	dependencies?: Record<string, string>;
	devDependencies?: Record<string, string>;
	bugs?: string;
	repository?: { type: string; url: string };
	keywords?: string[];
};

export async function getPackageJson(workspace: WorkspaceWithoutExplicitArgs): Promise<{
	text: string;
	data: Package;
}> {
	const packageText = await readFile(workspace, commonFilePaths.packageJsonFilePath);
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

	const packageJson: Package = parseJson(packageText) as Package;
	return {
		text: packageText,
		data: packageJson
	};
}
