import * as remoteControl from './adder/remoteControl';
import {
	executeAdder,
	executeAdders,
	determineWorkingDirectory,
	type AddersToApplySelectorParams,
	type AdderDetails,
	type ExecutingAdderInfo
} from './adder/execute';
import { createOrUpdateFiles } from './files/processors';
import { createEmptyWorkspace, populateWorkspaceDetails } from './utils/workspace';
import { suggestInstallingDependencies } from './utils/dependencies';
import { availableCliOptions, type AvailableCliOptions, type Question } from './adder/options';
import * as prompts from './utils/prompts';

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
