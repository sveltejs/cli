import { styleText } from 'node:util';

type WithFormat = (format: Parameters<typeof styleText>[0]) => (input: string | string[]) => string;
const withFormat: WithFormat = (format) => (input) =>
	styleText(format, Array.isArray(input) ? input.join(' ') : input);

export const color: Record<string, (input: string | string[]) => string> = {
	// Semantic colors
	addon: withFormat('greenBright'),
	command: withFormat(['bold', 'cyanBright']),
	env: withFormat('yellow'),
	path: withFormat('blueBright'),
	route: withFormat(['bold', 'underline']),
	website: withFormat('cyan'),
	optional: withFormat('gray'),
	dim: withFormat(['gray', 'dim']), // needed for terminal that don't support `dim` well

	// Status colors
	success: withFormat('green'),
	warning: withFormat('yellow'),
	error: withFormat('red'),

	// Visibility
	hidden: withFormat('hidden')
};
