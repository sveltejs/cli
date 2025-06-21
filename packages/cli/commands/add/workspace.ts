import fs from 'node:fs';
import path from 'node:path';
import * as find from 'empathic/find';
import { common, object, type AstTypes } from '@sveltejs/cli-core/js';
import { parseScript } from '@sveltejs/cli-core/parsers';
import { detect } from 'package-manager-detector';
import type { OptionValues, PackageManager, Workspace } from '@sveltejs/cli-core';
import { TESTING } from '../../utils/env.ts';
import { commonFilePaths, getPackageJson, readFile } from './utils.ts';
import { getUserAgent } from '../../utils/package-manager.ts';

type CreateWorkspaceOptions = {
	cwd: string;
	packageManager?: PackageManager;
	options?: OptionValues<any>;
};
export async function createWorkspace({
	cwd,
	options = {},
	packageManager
}: CreateWorkspaceOptions): Promise<Workspace<any>> {
	const resolvedCwd = path.resolve(cwd);
	const viteConfigPath = path.join(resolvedCwd, commonFilePaths.viteConfigTS);
	let usesTypescript = fs.existsSync(viteConfigPath);

	if (TESTING) {
		// while executing tests, we only look into the direct `cwd`
		// as we might detect the monorepo `tsconfig.json` otherwise.
		usesTypescript ||= fs.existsSync(path.join(resolvedCwd, commonFilePaths.tsconfig));
	} else {
		usesTypescript ||= find.up(commonFilePaths.tsconfig, { cwd }) !== undefined;
	}

	let dependencies: Record<string, string> = {};
	let directory = resolvedCwd;
	const root = findRoot(resolvedCwd);
	while (directory && directory !== root) {
		if (fs.existsSync(path.join(directory, commonFilePaths.packageJson))) {
			const { data: packageJson } = getPackageJson(directory);
			dependencies = {
				...packageJson.devDependencies,
				...packageJson.dependencies,
				...dependencies
			};
		}
		directory = path.dirname(directory);
	}
	// removes the version ranges (e.g. `^` is removed from: `^9.0.0`)
	for (const [key, value] of Object.entries(dependencies)) {
		dependencies[key] = value.replaceAll(/[^\d|.]/g, '');
	}

	return {
		cwd: resolvedCwd,
		options,
		packageManager: packageManager ?? (await detect({ cwd }))?.name ?? getUserAgent() ?? 'npm',
		typescript: usesTypescript,
		kit: dependencies['@sveltejs/kit'] ? parseKitOptions(resolvedCwd) : undefined,
		dependencyVersion: (pkg) => dependencies[pkg]
	};
}

function findRoot(cwd: string): string {
	const { root } = path.parse(cwd);
	let directory = cwd;
	while (directory && directory !== root) {
		if (fs.existsSync(path.join(directory, commonFilePaths.packageJson))) {
			if (fs.existsSync(path.join(directory, 'pnpm-workspace.yaml'))) {
				return directory;
			}
			const { data } = getPackageJson(directory);
			if (data.workspaces) {
				return directory;
			}
		}
		directory = path.dirname(directory);
	}
	return root;
}

function parseKitOptions(cwd: string) {
	const configSource = readFile(cwd, commonFilePaths.svelteConfig);
	const { ast } = parseScript(configSource);

	const defaultExport = ast.body.find((s) => s.type === 'ExportDefaultDeclaration');
	if (!defaultExport) throw Error('Missing default export in `svelte.config.js`');

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
			throw Error('Unable to find svelte config object expression from `svelte.config.js`');
	} else if (defaultExport.declaration.type === 'ObjectExpression') {
		// e.g. `export default { ... };`
		objectExpression = defaultExport.declaration;
	}

	// We'll error out since we can't safely determine the config object
	if (!objectExpression) throw new Error('Unexpected svelte config shape from `svelte.config.js`');

	const kit = object.property(objectExpression, { name: 'kit', fallback: object.create({}) });
	const files = object.property(kit, { name: 'files', fallback: object.create({}) });
	const routes = object.property(files, { name: 'routes', fallback: common.createLiteral('') });
	const lib = object.property(files, { name: 'lib', fallback: common.createLiteral('') });

	const routesDirectory = (routes.value as string) || 'src/routes';
	const libDirectory = (lib.value as string) || 'src/lib';

	return { routesDirectory, libDirectory };
}
