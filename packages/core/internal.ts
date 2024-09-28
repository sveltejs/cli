export { installPackages, findUp } from './files/utils.ts';
export { createOrUpdateFiles } from './files/processors.ts';
export {
	createWorkspace,
	guessPackageManager,
	getUserAgent,
	type Workspace
} from './files/workspace.ts';
export { TESTING } from './env.ts';
export type { Question } from './adder/options.ts';
