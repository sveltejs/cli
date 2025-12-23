import type { OptionDefinition, OptionValues } from './options.ts';

export type WorkspaceOptions<Args extends OptionDefinition> = OptionValues<Args>;

export type Workspace = {
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
	/** to know if the workspace is using typescript or javascript */
	ext: 'ts' | 'js';
	files: {
		viteConfig: 'vite.config.js' | 'vite.config.ts';
		svelteConfig: 'svelte.config.js' | 'svelte.config.ts';
		/** `${kit.routesDirectory}/layout.css` or `src/app.css` */
		stylesheet: `${string}/layout.css` | 'src/app.css';
		package: 'package.json';
		gitignore: '.gitignore';

		prettierignore: '.prettierignore';
		prettierrc: '.prettierrc';
		eslintConfig: 'eslint.config.js';

		vscodeSettings: '.vscode/settings.json';

		/** Get the relative path between two files */
		getRelative: ({ from, to }: { from?: string; to: string }) => string;
	};
	kit: { libDirectory: string; routesDirectory: string } | undefined;
	packageManager: PackageManager;
};

export type PackageManager = 'npm' | 'yarn' | 'pnpm' | 'bun' | 'deno';
