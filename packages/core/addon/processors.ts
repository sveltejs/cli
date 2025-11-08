import type { ConditionDefinition } from './config.ts';
import type { OptionDefinition } from './options.ts';
import type { Workspace } from './workspace.ts';

export type FileEditor = Workspace & { content: string };

export type FileType<Args extends OptionDefinition> = {
	name: (options: Workspace) => string;
	condition?: ConditionDefinition<Args>;
	content: (editor: FileEditor) => string;
};
