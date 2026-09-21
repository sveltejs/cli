import path from 'node:path';
import { svelteConfig, transforms, Walker, type AstTypes } from '@sveltejs/sv-utils';
import type { SvApi } from '../../../../core/config.ts';
import { defineMigrationTask } from '../../../index.ts';
import { addMigrationTask } from '../../../migration-task.ts';

const GENERATED_CONFIG = /(^|\/)\.svelte-kit\/tsconfig\.json$/;
const LEADING_PARENT = /^\.\.\//;

/** The config SvelteKit now generates into `node_modules`, replacing `.svelte-kit/tsconfig.json`. */
const PARENT_CONFIG = '$app/tsconfig';

/**
 * Options the generated config already sets. A local copy of the same value is noise, but a
 * different value is a deliberate override and stays.
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

type TypeConfig = {
	extends?: string | string[];
	include?: string[];
	compilerOptions?: Record<string, unknown>;
};

export default defineMigrationTask({
	id: 'tsconfig',
	description: 'Extend the generated $app/tsconfig instead of .svelte-kit/tsconfig.json',
	run: ({ sv, cwd, file }) => {
		if (!file.typeConfig) return;

		const moved = dropTypescriptOption(sv, cwd);

		sv.file(
			// `typeConfig` is resolved by walking up from `cwd`, so it can sit outside the project
			path.relative(cwd, file.typeConfig),
			transforms.json<TypeConfig>(({ data }) => {
				const extended = Array.isArray(data.extends) ? [...data.extends] : [data.extends];
				const index = extended.findIndex((entry) => entry && GENERATED_CONFIG.test(entry));

				// a prerequisite task may have retargeted `extends` already; the `include` paths below
				// still have to move, so only bail when neither config is referenced
				if (index === -1 && !extended.includes(PARENT_CONFIG)) return false;

				if (index !== -1) {
					extended[index] = PARENT_CONFIG;
					data.extends = Array.isArray(data.extends) ? (extended as string[]) : PARENT_CONFIG;
				}

				// the generated config no longer carries `include`, so the project owns it now
				const include = (data.include ??= ['src']);
				include.push(...moved.filter((entry) => !include.includes(entry)));

				// if types is set we need to add $app/types to it
				if (data.compilerOptions?.types) {
					const types = data.compilerOptions.types as string[];
					if (!types.includes('$app/types')) types.push('$app/types');
				}

				for (const [key, value] of Object.entries(data.compilerOptions ?? {})) {
					if (INHERITED_OPTIONS[key] === value) delete data.compilerOptions![key];
				}
			})
		);
	}
});

/**
 * Removes the deprecated `typescript.config` option, returning the paths its hook pushed onto
 * `include` so they can move to the project's own config. Hooks that do anything else are left in
 * place and flagged, since their intent can't be expressed as `include` entries.
 */
function dropTypescriptOption(sv: SvApi, cwd: string): string[] {
	if (!svelteConfig.find(cwd)) return [];

	const moved: string[] = [];

	svelteConfig.edit({ sv, cwd }, ({ ast, comments }) => {
		const found = findProperty(ast, 'typescript');
		if (!found) return false;

		const pushed = includePushes(found.property.value);
		if (!pushed) {
			addMigrationTask(
				'`typescript.config` is deprecated; configure TypeScript in tsconfig.json directly',
				{ comments, node: found.property }
			);
			return;
		}

		// pushed paths were relative to `.svelte-kit/`, the project config sits one level up
		moved.push(...pushed.map((entry) => entry.replace(LEADING_PARENT, '')));
		found.remove();
	});

	return moved;
}

type FoundProperty = { property: AstTypes.Property; remove: () => void };

/** Finds a property by name anywhere in the config, wherever the config keeps it. */
function findProperty(ast: AstTypes.Program, name: string): FoundProperty | undefined {
	let found: FoundProperty | undefined;

	Walker.walk(ast as AstTypes.Node, null, {
		ObjectExpression(node, { next }) {
			const property = node.properties.find(
				(p): p is AstTypes.Property =>
					p.type === 'Property' && p.key.type === 'Identifier' && p.key.name === name
			);
			if (property) {
				found ??= {
					property,
					remove: () => node.properties.splice(node.properties.indexOf(property), 1)
				};
			}
			next();
		}
	});

	return found;
}

/** The literal paths a `typescript.config` hook pushes onto `include`, if that's all it does. */
function includePushes(option: AstTypes.Node): string[] | undefined {
	if (option.type !== 'ObjectExpression' || option.properties.length !== 1) return undefined;

	const [config] = option.properties;
	if (config.type !== 'Property' || config.key.type !== 'Identifier') return undefined;
	if (config.key.name !== 'config') return undefined;

	const fn = config.value;
	if (fn.type !== 'ArrowFunctionExpression' && fn.type !== 'FunctionExpression') return undefined;
	if (fn.body.type !== 'BlockStatement') return undefined;

	const paths: string[] = [];
	for (const statement of fn.body.body) {
		if (statement.type !== 'ExpressionStatement') return undefined;
		const call = statement.expression;
		if (call.type !== 'CallExpression' || !isIncludePush(call.callee)) return undefined;

		for (const argument of call.arguments) {
			if (argument.type !== 'Literal' || typeof argument.value !== 'string') return undefined;
			paths.push(argument.value);
		}
	}

	return paths;
}

const memberName = (node: AstTypes.MemberExpression) =>
	node.property.type === 'Identifier' ? node.property.name : undefined;

/** Matches the callee of `config.include.push(...)`. */
function isIncludePush(callee: AstTypes.Node): boolean {
	return (
		callee.type === 'MemberExpression' &&
		memberName(callee) === 'push' &&
		callee.object.type === 'MemberExpression' &&
		memberName(callee.object) === 'include'
	);
}
