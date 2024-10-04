import fs from 'node:fs';
import path from 'node:path';
import * as find from 'empathic/find';
import * as resolve from 'empathic/resolve';
import { type AstTypes, parseScript } from '@svelte-cli/ast-tooling';
import { TESTING } from '../env.ts';
import { common, object } from '../tooling/js/index.ts';
import { commonFilePaths, getPackageJson, readFile } from './utils.ts';
import type { OptionDefinition, OptionValues, Question } from '../adder/options.ts';

export type Workspace<Args extends OptionDefinition> = {
	options: OptionValues<Args>;
	cwd: string;
	dependencies: Record<string, string>;
	prettier: boolean;
	typescript: boolean;
	kit: { libDirectory: string; routesDirectory: string } | undefined;
};

export type WorkspaceWithoutExplicitArgs = Workspace<Record<string, Question>>;

export function createEmptyWorkspace<Args extends OptionDefinition>() {
	return {
		options: {},
		cwd: '',
		prettier: false,
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

	const { data: packageJson } = getPackageJson(workspace);

	workspace.dependencies = { ...packageJson.devDependencies, ...packageJson.dependencies };
	workspace.typescript = usesTypescript;
	workspace.prettier = Boolean(resolve.from(cwd, 'prettier', true));
	if ('@sveltejs/kit' in workspace.dependencies) workspace.kit = parseKitOptions(workspace);
	for (const [key, value] of Object.entries(workspace.dependencies)) {
		// removes the version ranges (e.g. `^` is removed from: `^9.0.0`)
		workspace.dependencies[key] = value.replaceAll(/[^\d|.]/g, '');
	}

	return workspace;
}

function parseKitOptions(workspace: WorkspaceWithoutExplicitArgs) {
	const configSource = readFile(workspace, commonFilePaths.svelteConfig);
	const ast = parseScript(configSource);

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
