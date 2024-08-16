import * as remoteControl from './adder/remoteControl.js';
import {
	executeAdder,
	executeAdders,
	determineWorkingDirectory,
	type AddersToApplySelectorParams,
	type AdderDetails,
	type ExecutingAdderInfo
} from './adder/execute.js';
import { createOrUpdateFiles } from './files/processors.js';
import { createEmptyWorkspace, populateWorkspaceDetails } from './utils/workspace.js';
import { suggestInstallingDependencies } from './utils/dependencies.js';
import { availableCliOptions, type AvailableCliOptions, type Question } from './adder/options.js';
import * as prompts from './utils/prompts.js';

export {
	remoteControl,
	createOrUpdateFiles,
	createEmptyWorkspace,
	executeAdder,
	executeAdders,
	populateWorkspaceDetails,
	determineWorkingDirectory,
	prompts,
	suggestInstallingDependencies,
	availableCliOptions
};

export type {
	AvailableCliOptions,
	AddersToApplySelectorParams,
	AdderDetails,
	Question,
	ExecutingAdderInfo
};
