import { fileExists } from './files.ts';
import { coerceVersion } from './semver.ts';
import { svelteConfig, type ConfigFileReader, type SvFileApi } from './svelte-config.ts';
import type { AstTypes } from './tooling/index.ts';
import * as jsNs from './tooling/js/index.ts';
import { transforms } from './tooling/transforms.ts';

export type EnvMode = 'declared' | 'legacy';

export function resolveEnvMode({
	kitRange,
	explicitEnvFlag
}: {
	kitRange: string | undefined;
	explicitEnvFlag: boolean;
}): EnvMode {
	if (!kitRange) return 'legacy';
	if (kitRange === 'next') return 'declared';
	const { major } = coerceVersion(kitRange);
	if (major !== undefined && major >= 3) return 'declared';
	if (major === 2 && explicitEnvFlag) return 'declared';
	return 'legacy';
}

export type EnvScope = 'private' | 'public';

export type EnvVarSpec = {
	name: string;
	description?: string;
	public?: boolean;
	static?: boolean;
};

export type DefineEnvContext = {
	sv: SvFileApi;
	cwd: string;
	/** Resolves a dependency's range (the workspace's authoritative, walk-up-aware lookup). */
	dependencyVersion: (pkg: string) => string | undefined;
};

export type ReferenceOpts = { name: string; scope?: EnvScope; static?: boolean };

export type DefineEnv = {
	/** Resolved once from the project; add-ons don't need to consult it. */
	mode: EnvMode;
	define: (spec: EnvVarSpec) => void;
	reference: (ast: AstTypes.Program, js: typeof jsNs, opts: ReferenceOpts) => string;
};

function findProp(obj: AstTypes.ObjectExpression, name: string): AstTypes.Property | undefined {
	return obj.properties.find(
		(p): p is AstTypes.Property =>
			p.type === 'Property' && p.key.type === 'Identifier' && p.key.name === name
	);
}

export function readExplicitEnvFlag(source: string | ConfigFileReader): boolean {
	let objs;
	try {
		objs = svelteConfig.read(source);
	} catch {
		return false;
	}
	if (!objs) return false;
	const experimental = findProp(objs.kit, 'experimental');
	if (!experimental || experimental.value.type !== 'ObjectExpression') return false;
	const flag = findProp(experimental.value, 'explicitEnvironmentVariables');
	return !!flag && flag.value.type === 'Literal' && flag.value.value === true;
}

function getOrCreateVariablesObject(
	ast: AstTypes.Program,
	js: typeof jsNs
): AstTypes.ObjectExpression {
	for (const node of ast.body) {
		if (node.type !== 'ExportNamedDeclaration') continue;
		const decl = node.declaration;
		if (decl?.type !== 'VariableDeclaration') continue;
		const d = decl.declarations[0];
		if (
			d?.type === 'VariableDeclarator' &&
			d.id.type === 'Identifier' &&
			d.id.name === 'variables' &&
			d.init?.type === 'CallExpression' &&
			d.init.callee.type === 'Identifier' &&
			d.init.callee.name === 'defineEnvVars' &&
			d.init.arguments[0]?.type === 'ObjectExpression'
		) {
			return d.init.arguments[0] as AstTypes.ObjectExpression;
		}
	}
	const stmt = js.common.parseStatement(
		'export const variables = defineEnvVars({});'
	) as unknown as AstTypes.ExportNamedDeclaration;
	ast.body.push(stmt);
	const decl = stmt.declaration as AstTypes.VariableDeclaration;
	const call = decl.declarations[0].init as AstTypes.CallExpression;
	return call.arguments[0] as AstTypes.ObjectExpression;
}

/**
 * Detects the env mode from the project (the `@sveltejs/kit` range via `dependencyVersion`, or the
 * kit-2 `explicitEnvironmentVariables` flag read from the config at `cwd`) and binds the context. Add-ons
 * just call `define`/`reference` and never deal with the legacy-vs-declared distinction themselves.
 */
export function defineEnv({ sv, cwd, dependencyVersion }: DefineEnvContext): DefineEnv {
	const mode = resolveEnvMode({
		kitRange: dependencyVersion('@sveltejs/kit'),
		explicitEnvFlag: readExplicitEnvFlag(cwd)
	});
	const language = fileExists(cwd, 'tsconfig.json') ? 'ts' : 'js';
	return _bindEnv({ sv, mode, language });
}

/** @internal The mode-resolved core, exported for filesystem-free tests. */
export function _bindEnv({
	sv,
	mode,
	language
}: {
	sv: SvFileApi;
	mode: EnvMode;
	language: 'ts' | 'js';
}): DefineEnv {
	const declared = new Map<string, EnvVarSpec>();

	return {
		mode,
		define(spec) {
			declared.set(spec.name, spec);
			if (mode !== 'declared') return;
			const envPath = `src/env.${language}`;
			sv.file(envPath, (content) =>
				transforms.script(({ ast, js }) => {
					js.imports.addNamed(ast, { from: '@sveltejs/kit/hooks', imports: ['defineEnvVars'] });
					const variables = getOrCreateVariablesObject(ast, js);
					const entry = js.object.property(variables, {
						name: spec.name,
						fallback: js.object.create({})
					}) as AstTypes.ObjectExpression;
					const props: Record<string, AstTypes.Expression> = {};
					if (spec.description) props.description = js.common.createLiteral(spec.description);
					if (spec.public) props.public = js.common.createLiteral(true);
					if (spec.static) props.static = js.common.createLiteral(true);
					if (Object.keys(props).length) js.object.overrideProperties(entry, props);
				})(content)
			);
		},
		reference(ast, js, opts) {
			const spec = declared.get(opts.name);
			const scope: EnvScope = opts.scope ?? (spec?.public ? 'public' : 'private');
			const isStatic = opts.static ?? spec?.static ?? false;

			if (mode === 'declared') {
				js.imports.addNamed(ast, { from: `$app/env/${scope}`, imports: [opts.name] });
				return opts.name;
			}
			if (isStatic) {
				js.imports.addNamed(ast, { from: `$env/static/${scope}`, imports: [opts.name] });
				return opts.name;
			}
			js.imports.addNamed(ast, { from: `$env/dynamic/${scope}`, imports: ['env'] });
			return `env.${opts.name}`;
		}
	};
}
