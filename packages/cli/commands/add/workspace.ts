import fs from 'node:fs';
import path from 'node:path';
import * as find from 'empathic/find';
import { common, object, type AstTypes } from '@svelte-cli/core/js';
import { parseScript } from '@svelte-cli/core/parsers';
import { TESTING } from '../../env.ts';
import { commonFilePaths, getPackageJson, readFile } from './utils.ts';
import { detectPackageManager } from '../../common.ts';
import type { OptionDefinition, Workspace } from '@svelte-cli/core';

export function createEmptyWorkspace<Args extends OptionDefinition>() {
	return {
		options: {},
		cwd: '',
		dependencyVersion: (_pkg) => undefined,
		typescript: false,
		kit: undefined
	} as Workspace<Args>;
}

export function createWorkspace<Args extends OptionDefinition>(cwd: string): Workspace<Args> {
	const workspace = createEmptyWorkspace<Args>();
	workspace.cwd = cwd;

	let usesTypescript = fs.existsSync(path.join(cwd, commonFilePaths.viteConfigTS));

	if (TESTING) {
		// while executing tests, we only look into the direct `cwd`
		// as we might detect the monorepo `tsconfig.json` otherwise.
		usesTypescript ||= fs.existsSync(path.join(cwd, commonFilePaths.tsconfig));
	} else {
		usesTypescript ||= find.up(commonFilePaths.tsconfig, { cwd }) !== undefined;
	}

	let dependencies: Record<string, string> = {};
	let directory = workspace.cwd;
	const root = findRoot(workspace.cwd);
	while (directory && directory !== root) {
		const { data: packageJson } = getPackageJson(workspace.cwd);
		dependencies = { ...packageJson.devDependencies, ...packageJson.dependencies, ...dependencies };
		directory = path.dirname(directory);
	}
	// removes the version ranges (e.g. `^` is removed from: `^9.0.0`)
	for (const [key, value] of Object.entries(dependencies)) {
		dependencies[key] = value.replaceAll(/[^\d|.]/g, '');
	}

	workspace.dependencyVersion = (pkg) => {
		return dependencies[pkg];
	};
	workspace.typescript = usesTypescript;
	workspace.packageManager = detectPackageManager(cwd);
	if (workspace.dependencyVersion('@sveltejs/kit')) workspace.kit = parseKitOptions(workspace);
	return workspace;
}

function findRoot(cwd: string): string {
	const { root } = path.parse(cwd);
	let directory = cwd;
	while (directory && directory !== root) {
		if (fs.existsSync(path.join(directory, 'pnpm-workspace.yaml'))) {
			return directory;
		}
		const { data } = getPackageJson(directory);
		if (data.workspaces) {
			return directory;
		}
		directory = path.dirname(directory);
	}
	return root;
}

function parseKitOptions(workspace: Workspace<any>) {
	const configSource = readFile(workspace.cwd, commonFilePaths.svelteConfig);
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

	const kit = object.property(objectExpression, 'kit', object.createEmpty());
	const files = object.property(kit, 'files', object.createEmpty());
	const routes = object.property(files, 'routes', common.createLiteral());
	const lib = object.property(files, 'lib', common.createLiteral());

	const routesDirectory = (routes.value as string) || 'src/routes';
	const libDirectory = (lib.value as string) || 'src/lib';

	return { routesDirectory, libDirectory };
}
