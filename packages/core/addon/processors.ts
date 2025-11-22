import type { ConditionDefinition } from './config.ts';
import type { Workspace } from './workspace.ts';

export type FileEditor = Workspace & { content: string };

export type FileType = {
	name: (options: Workspace) => string;
	condition?: ConditionDefinition;
	content: (editor: FileEditor) => string;
};
