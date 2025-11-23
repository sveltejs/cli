import fs from 'node:fs';
import path from 'node:path';
import * as find from 'empathic/find';
import { common, object, type AstTypes } from '@sveltejs/cli-core/js';
import { parseScript } from '@sveltejs/cli-core/parsers';
import { detect } from 'package-manager-detector';
import type { PackageManager, Workspace } from '@sveltejs/cli-core';
import { commonFilePaths, getPackageJson, readFile } from './utils.ts';
import { getUserAgent } from '../../utils/package-manager.ts';

type CreateWorkspaceOptions = {
	cwd: string;
	packageManager?: PackageManager;
	override?: {
		kit?: Workspace['kit'];
	};
};
export async function createWorkspace({
	cwd,
	packageManager,
	override
}: CreateWorkspaceOptions): Promise<Workspace> {
	const resolvedCwd = path.resolve(cwd);

	// Will go up and prioritize jsconfig.json as it's first in the array
	const tjsconfig = find.any([commonFilePaths.jsconfig, commonFilePaths.tsconfig], { cwd });
	// If the file is not ending with jsconfig.json, then we are using typescript
	const usesTypescript = !tjsconfig?.endsWith(commonFilePaths.jsconfig);

	// This is not linked with typescript detection
	const viteConfigPath = path.join(resolvedCwd, commonFilePaths.viteConfigTS);
	const viteConfig = fs.existsSync(viteConfigPath)
		? commonFilePaths.viteConfigTS
		: commonFilePaths.viteConfig;
	const svelteConfigPath = path.join(resolvedCwd, commonFilePaths.svelteConfigTS);
	const svelteConfig = fs.existsSync(svelteConfigPath)
		? commonFilePaths.svelteConfigTS
		: commonFilePaths.svelteConfig;

	let dependencies: Record<string, string> = {};
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
	// removes the version ranges (e.g. `^` is removed from: `^9.0.0`)
	for (const [key, value] of Object.entries(dependencies)) {
		dependencies[key] = value.replaceAll(/[^\d|.]/g, '');
	}

	const kit = override?.kit
		? override.kit
		: dependencies['@sveltejs/kit']
			? parseKitOptions(resolvedCwd)
			: undefined;

	const stylesheet: `${string}/layout.css` | 'src/app.css' = kit
		? `${kit.routesDirectory}/layout.css`
		: 'src/app.css';

	return {
		cwd: resolvedCwd,
		packageManager: packageManager ?? (await detect({ cwd }))?.name ?? getUserAgent() ?? 'npm',
		typescript: usesTypescript,
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

function findWorkspaceRoot(cwd: string): string {
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

function parseKitOptions(cwd: string) {
	const configSource = readFile(cwd, commonFilePaths.svelteConfig);
	const { ast } = parseScript(configSource);

	const defaultExport = ast.body.find((s) => s.type === 'ExportDefaultDeclaration');
	if (!defaultExport) throw Error(`Missing default export in \`${commonFilePaths.svelteConfig}\``);

	let objectExpression: AstTypes.ObjectExpression | undefined;
	if (defaultExport.declaration.type === 'Identifier') {
		// e.g. `export default config;`
		const identifier = defaultExport.declaration;
		for (const declaration of ast.body) {
			if (declaration.type !== 'VariableDeclaration') continue;

			const declarator = declaration.declarations.find(
				(d): d is AstTypes.VariableDeclarator =>
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

	const kit = object.property(objectExpression, { name: 'kit', fallback: object.create({}) });
	const files = object.property(kit, { name: 'files', fallback: object.create({}) });
	const routes = object.property(files, { name: 'routes', fallback: common.createLiteral('') });
	const lib = object.property(files, { name: 'lib', fallback: common.createLiteral('') });

	const routesDirectory = (routes.value as string) || 'src/routes';
	const libDirectory = (lib.value as string) || 'src/lib';

	return { routesDirectory, libDirectory };
}
