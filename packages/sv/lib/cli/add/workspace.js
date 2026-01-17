/** @import { AstTypes, PackageManager, Workspace } from '../../core.js' */
import * as find from 'empathic/find';
import fs from 'node:fs';
import path from 'node:path';
import { detect } from 'package-manager-detector';

import { js, parse } from '../../core.js';
import { getUserAgent } from '../utils/package-manager.js';
import { commonFilePaths, getPackageJson, readFile } from './utils.js';

/**
 * @typedef {{
 *   cwd: string;
 *   packageManager?: PackageManager;
 *   override?: {
 *     kit?: Workspace['kit'];
 *     dependencies: Record<string, string>;
 *   };
 * }} CreateWorkspaceOptions
 */

/**
 * @param {CreateWorkspaceOptions} options
 * @returns {Promise<Workspace>}
 */
export async function createWorkspace({ cwd, packageManager, override }) {
	const resolvedCwd = path.resolve(cwd);

	// Will go up and prioritize jsconfig.json as it's first in the array
	const jtsConfigPath = find.any([commonFilePaths.jsconfig, commonFilePaths.tsconfig], { cwd });
	const typescript = jtsConfigPath?.endsWith(commonFilePaths.tsconfig) ?? false;

	// This is not linked with typescript detection
	const viteConfigPath = path.join(resolvedCwd, commonFilePaths.viteConfigTS);
	const viteConfig = fs.existsSync(viteConfigPath)
		? commonFilePaths.viteConfigTS
		: commonFilePaths.viteConfig;
	const svelteConfigPath = path.join(resolvedCwd, commonFilePaths.svelteConfigTS);
	const svelteConfig = fs.existsSync(svelteConfigPath)
		? commonFilePaths.svelteConfigTS
		: commonFilePaths.svelteConfig;

	/** @type {Record<string, string>} */
	let dependencies = {};
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
			if (fs.existsSync(path.join(directory, commonFilePaths.packageJson))) {
				const { data: packageJson } = getPackageJson(directory);
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

	// removes the version ranges (e.g. `^` is removed from: `^9.0.0`)
	for (const [key, value] of Object.entries(dependencies)) {
		dependencies[key] = value.replaceAll(/[^\d|.]/g, '');
	}

	const kit = override?.kit
		? override.kit
		: dependencies['@sveltejs/kit']
			? parseKitOptions(resolvedCwd)
			: undefined;

	/** @type {`${string}/layout.css` | 'src/app.css'} */
	const stylesheet = kit ? `${kit.routesDirectory}/layout.css` : 'src/app.css';

	return {
		cwd: resolvedCwd,
		packageManager: packageManager ?? (await detect({ cwd }))?.name ?? getUserAgent() ?? 'npm',
		language: typescript ? 'ts' : 'js',
		files: {
			viteConfig,
			svelteConfig,
			stylesheet,
			package: 'package.json',
			gitignore: '.gitignore',
			prettierignore: '.prettierignore',
			prettierrc: '.prettierrc',
			eslintConfig: 'eslint.config.js',
			vscodeSettings: '.vscode/settings.json',
			getRelative({ from, to }) {
				from = from ?? '';
				let relativePath = path.posix.relative(path.posix.dirname(from), to);
				// Ensure relative paths start with ./ for proper relative path syntax
				if (!relativePath.startsWith('.') && !relativePath.startsWith('/')) {
					relativePath = `./${relativePath}`;
				}
				return relativePath;
			}
		},
		kit,
		dependencyVersion: (pkg) => dependencies[pkg]
	};
}

/**
 * @param {string} cwd
 * @returns {string}
 */
function findWorkspaceRoot(cwd) {
	const { root } = path.parse(cwd);
	let directory = cwd;
	while (directory && directory !== root) {
		if (fs.existsSync(path.join(directory, commonFilePaths.packageJson))) {
			// in pnpm it can be a file
			if (fs.existsSync(path.join(directory, 'pnpm-workspace.yaml'))) {
				return directory;
			}
			// in other package managers it's a workspaces key in the package.json
			const { data } = getPackageJson(directory);
			if (data.workspaces) {
				return directory;
			}
		}
		directory = path.dirname(directory);
	}
	// We didn't find a workspace root, so we return the original directory
	// it's a standalone project
	return cwd;
}

/**
 * @param {string} cwd
 * @returns {{ routesDirectory: string; libDirectory: string }}
 */
function parseKitOptions(cwd) {
	const configSource = readFile(cwd, commonFilePaths.svelteConfig);
	const { ast } = parse.script(configSource);

	const defaultExport = ast.body.find((s) => s.type === 'ExportDefaultDeclaration');
	if (!defaultExport) throw Error(`Missing default export in \`${commonFilePaths.svelteConfig}\``);

	/** @type {AstTypes.ObjectExpression | undefined} */
	let objectExpression;
	if (defaultExport.declaration.type === 'Identifier') {
		// e.g. `export default config;`
		const identifier = defaultExport.declaration;
		for (const declaration of ast.body) {
			if (declaration.type !== 'VariableDeclaration') continue;

			const declarator = declaration.declarations.find(
				/** @returns {d is AstTypes.VariableDeclarator} */
				(d) =>
					d.type === 'VariableDeclarator' &&
					d.id.type === 'Identifier' &&
					d.id.name === identifier.name
			);

			if (declarator?.init?.type !== 'ObjectExpression') continue;

			objectExpression = declarator.init;
		}

		if (!objectExpression)
			throw Error(
				`Unable to find svelte config object expression from \`${commonFilePaths.svelteConfig}\``
			);
	} else if (defaultExport.declaration.type === 'ObjectExpression') {
		// e.g. `export default { ... };`
		objectExpression = defaultExport.declaration;
	}

	// We'll error out since we can't safely determine the config object
	if (!objectExpression)
		throw new Error(`Unexpected svelte config shape from \`${commonFilePaths.svelteConfig}\``);

	const kit = js.object.property(objectExpression, { name: 'kit', fallback: js.object.create({}) });
	const files = js.object.property(kit, { name: 'files', fallback: js.object.create({}) });
	const routes = js.object.property(files, {
		name: 'routes',
		fallback: js.common.createLiteral('')
	});
	const lib = js.object.property(files, { name: 'lib', fallback: js.common.createLiteral('') });

	const routesDirectory = /** @type {string} */ (routes.value) || 'src/routes';
	const libDirectory = /** @type {string} */ (lib.value) || 'src/lib';

	return { routesDirectory, libDirectory };
}
