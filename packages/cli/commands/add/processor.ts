import { fileExistsWorkspace, readFile, writeFile } from './utils.ts';
import type { Workspace, OptionDefinition, FileType } from '@svelte-cli/core';

/**
 * @param files
 * @param workspace
 * @returns a list of paths of changed or created files
 */
export function createOrUpdateFiles<Args extends OptionDefinition>(
	files: Array<FileType<Args>>,
	workspace: Workspace<Args>
): string[] {
	const changedFiles: string[] = [];
	for (const fileDetails of files) {
		try {
			if (fileDetails.condition && !fileDetails.condition(workspace)) {
				continue;
			}

			const exists = fileExistsWorkspace(workspace, fileDetails.name(workspace));
			let content = exists ? readFile(workspace, fileDetails.name(workspace)) : '';
			// process file
			content = fileDetails.content({ content, ...workspace });

			writeFile(workspace, fileDetails.name(workspace), content);
			changedFiles.push(fileDetails.name(workspace));
		} catch (e) {
			if (e instanceof Error)
				throw new Error(`Unable to process '${fileDetails.name(workspace)}'. Reason: ${e.message}`);
			throw e;
		}
	}
	return changedFiles;
}
