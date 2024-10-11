import type { OptionDefinition, OptionValues } from './options.ts';

export type Workspace<Args extends OptionDefinition> = {
	options: OptionValues<Args>;
	cwd: string;
	/**
	 * Returns the dependency version declared in the package.json.
	 * This may differ from the installed version.
	 * Includes both dependencies and devDependencies.
	 * Also checks parent package.json files if called in a monorepo.
	 * @param pkg the package to check for
	 * @returns the dependency version with any leading characters such as ^ or ~ removed
	 */
	dependencyVersion: (pkg: string) => string | undefined;
	typescript: boolean;
	kit: { libDirectory: string; routesDirectory: string } | undefined;
	packageManager: 'npm' | 'yarn' | 'pnpm' | 'bun';
};
