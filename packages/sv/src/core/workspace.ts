import { type AgentName, js, loadPackageJson, minVersion, svelteConfig } from '@sveltejs/sv-utils';
import * as find from 'empathic/find';
import fs from 'node:fs';
import path from 'node:path';
import { filePaths } from './common.ts';
import type { OptionDefinition, OptionValues } from './options.ts';
import { detectPackageManager } from './package-manager.ts';

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
	language: 'ts' | 'js';
	file: {
		viteConfig: 'vite.config.js' | 'vite.config.ts';
		typeConfig: 'jsconfig.json' | 'tsconfig.json' | undefined;
		/** `${directory.routes}/layout.css` or `src/app.css` */
		stylesheet: `${string}/layout.css` | 'src/app.css';
		package: 'package.json';
		gitignore: '.gitignore';

		/** Get the relative path between two files */
		getRelative: ({ from, to }: { from?: string; to: string }) => string;

		/**
		 * Find a file by walking up the directory tree from cwd.
		 * Returns the relative path from cwd, or the filename itself if not found.
		 */
		findUp: (filename: string) => string;
	};
	isKit: boolean;
	directory: {
		src: string;
		/** In SvelteKit taking `kit.files.lib` automatically. Falls back to `src/lib` in non-Kit projects */
		lib: string;
		/** In SvelteKit taking `kit.files.routes` automatically. Falls back to `src/routes` in non-Kit projects */
		kitRoutes: string;
	};
	/** The package manager used to install dependencies */
	packageManager: AgentName;
};

type CreateWorkspaceOptions = {
	cwd: string;
	packageManager?: AgentName;
	override?: {
		isKit?: boolean;
		directory?: Workspace['directory'];
		dependencies: Record<string, string>;
	};
};

export async function createWorkspace({
	cwd,
	packageManager,
	override
}: CreateWorkspaceOptions): Promise<Workspace> {
	const resolvedCwd = path.resolve(cwd);

	// Will go up and prioritize jsconfig.json as it's first in the array
	const typeConfigOptions = [filePaths.jsconfig, filePaths.tsconfig];
	const typeConfig = find.any(typeConfigOptions, { cwd }) as Workspace['file']['typeConfig'];
	const typescript = typeConfig?.endsWith(filePaths.tsconfig) ?? false;
	// This is not linked with typescript detection
	const viteConfigPath = path.join(resolvedCwd, filePaths.viteConfigTS);
	const viteConfig = fs.existsSync(viteConfigPath) ? filePaths.viteConfigTS : filePaths.viteConfig;

	let dependencies: Record<string, string> = {};
	if (override?.dependencies) {
		dependencies = override.dependencies;
	} else {
		let directory = resolvedCwd;
		const workspaceRoot = findWorkspaceRoot(directory);
		const { root } = path.parse(directory);
		while (
			// we have a directory
			directory &&
			// we are still in the workspace (including the workspace root)
			directory.length >= workspaceRoot.length
		) {
			if (fs.existsSync(path.join(directory, filePaths.packageJson))) {
				const { data: packageJson } = loadPackageJson(directory);
				dependencies = {
					...packageJson.devDependencies,
					...packageJson.dependencies,
					...dependencies
				};
			}
			if (root === directory) break; // we are at the root root, let's stop
			directory = path.dirname(directory);
		}
	}

	// removes the version ranges (e.g. `^` is removed from: `^9.0.0`).
	// non-semver values (e.g. `latest`, `workspace:*`, `git+...`) are left untouched.
	for (const [key, value] of Object.entries(dependencies)) {
		try {
			dependencies[key] = minVersion(value);
		} catch {
			// keep original value
		}
	}

	const isKit = override?.isKit ?? !!dependencies['@sveltejs/kit'];
	const directory = override?.directory
		? override.directory
		: isKit
			? { src: 'src', ...parseKitOptions(resolvedCwd) }
			: { src: 'src', lib: 'src/lib', kitRoutes: 'src/routes' };

	const stylesheet: `${string}/layout.css` | 'src/app.css' = isKit
		? `${directory.kitRoutes}/layout.css`
		: 'src/app.css';

	return {
		cwd: resolvedCwd,
		packageManager: packageManager ?? (await detectPackageManager(cwd)),
		language: typescript ? 'ts' : 'js',
		file: {
			viteConfig,
			typeConfig,
			stylesheet,
			package: 'package.json',
			gitignore: '.gitignore',
			getRelative({ from, to }) {
				from = from ?? '';
				let relativePath = path.posix.relative(path.posix.dirname(from), to);
				// Ensure relative paths start with ./ for proper relative path syntax
				if (!relativePath.startsWith('.') && !relativePath.startsWith('/')) {
					relativePath = `./${relativePath}`;
				}
				return relativePath;
			},
			findUp(filename) {
				const found = find.up(filename, { cwd: resolvedCwd });
				if (!found) return filename;
				// don't escape .test-output during tests
				if (resolvedCwd.includes('.test-output') && !found.includes('.test-output')) {
					return filename;
				}
				return path.relative(resolvedCwd, found);
			}
		},
		isKit,
		directory,
		dependencyVersion: (pkg) => dependencies[pkg]
	};
}

export function findWorkspaceRoot(cwd: string): string {
	const { root } = path.parse(cwd);
	let directory = cwd;
	while (directory && directory !== root) {
		if (fs.existsSync(path.join(directory, filePaths.packageJson))) {
			// in pnpm it can be a file
			if (fs.existsSync(path.join(directory, 'pnpm-workspace.yaml'))) {
				return directory;
			}
			// in other package managers it's a workspaces key in the package.json
			const { data } = loadPackageJson(directory);
			if (data.workspaces) {
				return directory;
			}
		}
		const parent = path.dirname(directory);
		// For test isolation: don't walk up past .test-output directories
		if (directory.includes('.test-output') && !parent.includes('.test-output')) break;
		directory = parent;
	}
	// We didn't find a workspace root, so we return the original directory
	// it's a standalone project
	return cwd;
}

/**
 * Reads `kit.files.lib` / `kit.files.routes` from wherever the config lives - a
 * `svelte.config.{js,ts}` default export, or the object passed to `sveltekit()` in a
 * `vite.config.{js,ts}`. Falls back to the SvelteKit defaults when no config is found
 * (e.g. a freshly created project that keeps its config in `vite.config.js`).
 */
function parseKitOptions(cwd: string): { lib: string; kitRoutes: string } {
	const fallback = { lib: 'src/lib', kitRoutes: 'src/routes' };

	let kit;
	try {
		// `read` locates + parses in one pass (no double parse); tolerate a malformed/odd config
		const config = svelteConfig.read(cwd);
		if (!config) return fallback;
		kit = config.kit;
	} catch {
		return fallback;
	}

	const files = js.object.property(kit, { name: 'files', fallback: js.object.create({}) });
	const routes = js.object.property(files, {
		name: 'routes',
		fallback: js.common.createLiteral('')
	});
	const lib = js.object.property(files, { name: 'lib', fallback: js.common.createLiteral('') });

	return {
		lib: (lib.value as string) || fallback.lib,
		kitRoutes: (routes.value as string) || fallback.kitRoutes
	};
}
