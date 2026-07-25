import { svelteConfig, transforms, Walker, type AstTypes } from '@sveltejs/sv-utils';
import path from 'node:path';
import { defineMigrationTask } from '../../../index.ts';
import { addMigrationTask } from '../../../migration-task.ts';

const GENERATED_CONFIG = /(^|\/)\.svelte-kit\/tsconfig\.json$/;
const LEADING_PARENT = /^\.\.\//;

/** The id of the config SvelteKit now generates into `node_modules`. */
const PARENT_CONFIG = '$app/tsconfig';

/**
 * Compiler options the generated config already sets. A local copy of the same value is noise, but
 * a different value is a deliberate override and stays.
 */
const INHERITED_OPTIONS: Record<string, unknown> = {
	allowImportingTsExtensions: true,
	allowJs: true,
	checkJs: true,
	esModuleInterop: true,
	forceConsistentCasingInFileNames: true,
	isolatedModules: true,
	module: 'esnext',
	moduleDetection: 'force',
	moduleResolution: 'bundler',
	noEmit: true,
	resolveJsonModule: true,
	skipLibCheck: true,
	target: 'esnext',
	verbatimModuleSyntax: true
};

export default defineMigrationTask({
	id: 'tsconfig',
	description: 'Extend the generated $app/tsconfig instead of .svelte-kit/tsconfig.json',
	run: ({ sv, cwd, file }) => {
		if (!file.typeConfig) return;

		// paths the deprecated `typescript.config` hook used to add, so they can move to `include`
		const extraIncludes = migrateTypescriptOption({ sv, cwd });

		sv.file(
			// `typeConfig` is resolved by walking up from `cwd`, so it can sit outside the project
			path.relative(cwd, file.typeConfig),
			transforms.json<TypeConfig>(({ data }) => {
				if (!retarget(data)) return false;

				// the generated config no longer carries `include`, so the project owns it now
				const include = (data.include ??= ['src']);
				for (const entry of extraIncludes) {
					if (!include.includes(entry)) include.push(entry);
				}

				for (const [key, value] of Object.entries(data.compilerOptions ?? {})) {
					if (INHERITED_OPTIONS[key] === value) delete data.compilerOptions![key];
				}
			})
		);
	}
});

type TypeConfig = {
	extends?: string | string[];
	include?: string[];
	compilerOptions?: Record<string, unknown>;
};

/** Points `extends` at the new parent config. Returns `false` when there was nothing to retarget. */
function retarget(data: TypeConfig): boolean {
	if (typeof data.extends === 'string') {
		if (!GENERATED_CONFIG.test(data.extends)) return false;
		data.extends = PARENT_CONFIG;
		return true;
	}

	if (!Array.isArray(data.extends)) return false;

	const index = data.extends.findIndex((entry) => GENERATED_CONFIG.test(entry));
	if (index === -1) return false;
	data.extends[index] = PARENT_CONFIG;
	return true;
}

/**
 * Drops the deprecated `typescript.config` option, returning the paths its hook pushed onto
 * `include` so the caller can write them to the project's own config. Hooks that do anything else
 * are left in place and flagged, since their intent can't be expressed as `include` entries.
 */
function migrateTypescriptOption({ sv, cwd }: { sv: SvApi; cwd: string }): string[] {
	const location = svelteConfig.find(cwd);
	if (!location) return [];

	const includes: string[] = [];

	svelteConfig.edit({ sv, cwd }, ({ ast, comments }) => {
		const option = findTypescriptOption(ast);
		if (!option) return false;

		const pushed = collectIncludePushes(option.value);
		if (!pushed) {
			addMigrationTask(
				'`typescript.config` is deprecated; configure TypeScript in tsconfig.json directly',
				{ comments, node: option.property }
			);
			return;
		}

		// pushed paths were relative to `.svelte-kit/`, the project config sits one level up
		includes.push(...pushed.map((entry) => entry.replace(LEADING_PARENT, '')));
		option.container.properties.splice(
			option.container.properties.indexOf(option.property as never),
			1
		);
		if (option.container.properties.length === 0) dropEmptySveltekitArgument(ast);
	});

	return includes;
}

type SvApi = Parameters<typeof svelteConfig.edit>[0]['sv'];

/** Turns a `sveltekit({})` left behind by the removed option back into `sveltekit()`. */
function dropEmptySveltekitArgument(ast: AstTypes.Program): void {
	Walker.walk(ast as AstTypes.Node, null, {
		CallExpression(node: AstTypes.CallExpression, { next }: Walker.Context<never, null>) {
			const [argument] = node.arguments;
			if (
				node.callee.type === 'Identifier' &&
				node.callee.name === 'sveltekit' &&
				node.arguments.length === 1 &&
				argument.type === 'ObjectExpression' &&
				argument.properties.length === 0
			) {
				node.arguments = [];
			}
			next();
		}
	});
}

type TypescriptOption = {
	container: AstTypes.ObjectExpression;
	property: AstTypes.Property;
	value: AstTypes.ObjectExpression;
};

/** Locates the kit-level `typescript: { config }` option, wherever the config keeps it. */
function findTypescriptOption(ast: AstTypes.Program): TypescriptOption | undefined {
	let found: TypescriptOption | undefined;

	Walker.walk(ast as AstTypes.Node, null, {
		ObjectExpression(node: AstTypes.ObjectExpression, { next }: Walker.Context<never, null>) {
			for (const property of node.properties) {
				if (property.type !== 'Property') continue;
				if (property.key.type !== 'Identifier' || property.key.name !== 'typescript') continue;
				if (property.value.type !== 'ObjectExpression') continue;
				found ??= { container: node, property, value: property.value };
			}
			next();
		}
	});

	return found;
}

/**
 * Returns the string literals a `config` hook pushes onto `config.include`, or `undefined` when the
 * hook does anything beyond those pushes.
 */
function collectIncludePushes(option: AstTypes.ObjectExpression): string[] | undefined {
	const config = option.properties.find(
		(p): p is AstTypes.Property =>
			p.type === 'Property' && p.key.type === 'Identifier' && p.key.name === 'config'
	);
	if (!config || option.properties.length > 1) return undefined;

	const fn = config.value;
	if (fn.type !== 'ArrowFunctionExpression' && fn.type !== 'FunctionExpression') return undefined;
	if (fn.body.type !== 'BlockStatement') return undefined;

	const includes: string[] = [];
	for (const statement of fn.body.body) {
		if (statement.type !== 'ExpressionStatement') return undefined;
		const args = includePushArguments(statement.expression);
		if (!args) return undefined;
		includes.push(...args);
	}

	return includes;
}

/** Returns the string arguments of a `config.include.push(...)` call, if that's what `node` is. */
function includePushArguments(node: AstTypes.Expression): string[] | undefined {
	if (node.type !== 'CallExpression') return undefined;
	const callee = node.callee;
	if (callee.type !== 'MemberExpression' || callee.property.type !== 'Identifier') return undefined;
	if (callee.property.name !== 'push') return undefined;

	const include = callee.object;
	if (include.type !== 'MemberExpression' || include.property.type !== 'Identifier')
		return undefined;
	if (include.property.name !== 'include') return undefined;

	const args: string[] = [];
	for (const arg of node.arguments) {
		if (arg.type !== 'Literal' || typeof arg.value !== 'string') return undefined;
		args.push(arg.value);
	}
	return args;
}
