import { create } from '@sveltejs/create';
import { createWorkspace } from './commands/add/workspace.ts';
import { installPackages } from './commands/add/utils.ts';
import { createOrUpdateFiles } from './commands/add/processor.ts';

export { create };

// todo: this should not be exported here, rather in something internal
// we should avoid duplicating the code thought due to maintance overhead
export { createWorkspace, installPackages, createOrUpdateFiles };
