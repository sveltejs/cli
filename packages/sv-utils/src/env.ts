import { coerceVersion } from './semver.ts';

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

import type { AstTypes } from './tooling/index.ts';
import * as jsNs from './tooling/js/index.ts';

export type EnvScope = 'private' | 'public';

export type EnvVarSpec = {
	name: string;
	description?: string;
	public?: boolean;
	static?: boolean;
};

export type DefineEnvContext = {
	sv: { file: (path: string, edit: (content: string) => string | false) => void };
	cwd: string;
	language: 'ts' | 'js';
	dependencyVersion: (pkg: string) => string | undefined;
};

export type ReferenceOpts = { name: string; scope?: EnvScope; static?: boolean };

export type DefineEnv = {
	mode: EnvMode;
	declare: (spec: EnvVarSpec) => void;
	reference: (ast: AstTypes.Program, js: typeof jsNs, opts: ReferenceOpts) => string;
};

export function defineEnv(ctx: DefineEnvContext): DefineEnv {
	const mode = resolveEnvMode({ kitRange: ctx.dependencyVersion('@sveltejs/kit'), explicitEnvFlag: false });
	const declared = new Map<string, EnvVarSpec>();

	return {
		mode,
		declare() {},
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
