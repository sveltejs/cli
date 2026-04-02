import { styleText } from 'node:util';

type ColorInput = string | string[];
const toStr = (input: ColorInput): string => (Array.isArray(input) ? input.join(' ') : input);

export const color = {
	// Semantic colors
	addon: (str: ColorInput): string => styleText('greenBright', toStr(str)),
	command: (str: ColorInput): string => styleText(['bold', 'cyanBright'], toStr(str)),
	env: (str: ColorInput): string => styleText('yellow', toStr(str)),
	path: (str: ColorInput): string => styleText('blueBright', toStr(str)),
	route: (str: ColorInput): string => styleText(['bold', 'underline'], toStr(str)),
	website: (str: ColorInput): string => styleText('cyan', toStr(str)),
	optional: (str: ColorInput): string => styleText('gray', toStr(str)),
	dim: (str: ColorInput): string => styleText(['gray', 'dim'], toStr(str)), // needed for terminal that don't support `dim` well

	// Status colors
	success: (str: ColorInput): string => styleText('green', toStr(str)),
	warning: (str: ColorInput): string => styleText('yellow', toStr(str)),
	error: (str: ColorInput): string => styleText('red', toStr(str)),

	// Visibility
	hidden: (str: ColorInput): string => styleText('hidden', toStr(str))
};
