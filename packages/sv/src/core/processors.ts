import type { ConditionDefinition } from './config.ts';
import type { Workspace } from './workspace.ts';

/** @deprecated Unused type, will be removed in a future version. */
export type FileEditor = Workspace & { content: string };

/** @deprecated Unused type, will be removed in a future version. */
export type FileType = {
	name: (options: Workspace) => string;
	condition?: ConditionDefinition;
	content: (editor: FileEditor) => string;
};
