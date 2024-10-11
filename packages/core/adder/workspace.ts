import type { OptionDefinition, OptionValues } from './options.ts';

export type Workspace<Args extends OptionDefinition> = {
	options: OptionValues<Args>;
	cwd: string;
	dependencies: Record<string, string>;
	prettier: boolean;
	typescript: boolean;
	kit: { libDirectory: string; routesDirectory: string } | undefined;
	packageManager: 'npm' | 'yarn' | 'pnpm' | 'bun';
};
