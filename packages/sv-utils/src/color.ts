import { styleText } from 'node:util';

export const color = {
	// Semantic colors
	addon: (str: string): string => styleText('greenBright', str),
	command: (str: string): string => styleText(['bold', 'cyanBright'], str),
	env: (str: string): string => styleText('yellow', str),
	path: (str: string): string => styleText('blueBright', str),
	route: (str: string): string => styleText(['bold', 'underline'], str),
	website: (str: string): string => styleText('cyan', str),
	optional: (str: string): string => styleText('gray', str),
	dim: (str: string): string => styleText(['gray', 'dim'], str), // needed for terminal that don't support `dim` well

	// Status colors
	success: (str: string): string => styleText('green', str),
	warning: (str: string): string => styleText('yellow', str),
	error: (str: string): string => styleText('red', str)
};
