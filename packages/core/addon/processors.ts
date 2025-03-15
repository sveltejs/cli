import type { ConditionDefinition } from './config.ts';
import type { OptionDefinition } from './options.ts';
import type { Workspace } from './workspace.ts';

export type FileEditor<Args extends OptionDefinition> = Workspace<Args> & { content: string };

export type FileType<Args extends OptionDefinition> = {
	name: (options: Workspace<Args>) => string;
	condition?: ConditionDefinition<Args>;
	content: (editor: FileEditor<Args>) => string;
};
