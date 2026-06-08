import * as Walker from 'zimmerframe';
import type { AstTypes } from '../index.ts';
import * as array from './array.ts';
import * as exports from './exports.ts';
import * as imports from './imports.ts';
import * as object from './object.ts';
import * as vite from './vite.ts';

/**
 * Where the svelte/kit config lives:
 * - `svelte`: a `svelte.config.{js,ts}` with `export default { ...svelteOptions, kit: { ...kitOptions } }`
 * - `vite`: a `vite.config.{js,ts}` with the config passed to `sveltekit({ ...svelteOptions, ...kitOptions })`
 *
 * In the `vite` shape kit options are flattened onto the same object as the svelte options
 * (it accepts `KitConfig & SvelteConfig`), which is why `config` and `kit` point at the same
 * object expression there.
 */
export type SvelteConfigKind = 'svelte' | 'vite';

/** Does the program have a default export? (used to detect a `svelte.config` config). */
export function hasDefaultExport(ast: AstTypes.Program): boolean {
	return ast.body.some((node) => node.type === 'ExportDefaultDeclaration');
}

/**
 * Resolves the local name `sveltekit` is imported as from `@sveltejs/kit/vite`, honouring aliases
 * (e.g. `import { sveltekit as youhou } from '@sveltejs/kit/vite'` -> `youhou`).
 * Returns `'sveltekit'` when no such import is found.
 */
function sveltekitLocalName(ast: AstTypes.Program): string {
	for (const node of ast.body) {
		if (node.type !== 'ImportDeclaration' || node.source.value !== '@sveltejs/kit/vite') continue;
		for (const spec of node.specifiers ?? []) {
			if (
				spec.type === 'ImportSpecifier' &&
				spec.imported.type === 'Identifier' &&
				spec.imported.name === 'sveltekit'
			) {
				return spec.local.name;
			}
		}
	}
	return 'sveltekit';
}

/** Finds the `sveltekit(...)` plugin call anywhere in the program (used to detect a `vite.config` config). */
export function findSveltekitCall(ast: AstTypes.Program): AstTypes.CallExpression | undefined {
	const name = sveltekitLocalName(ast);
	let call: AstTypes.CallExpression | undefined;
	Walker.walk(ast as AstTypes.Node, null, {
		CallExpression(node, { next }) {
			if (node.callee.type === 'Identifier' && node.callee.name === name) {
				call ??= node;
			}
			next();
		}
	});
	return call;
}

/** Unwraps `... satisfies T` / `... as T` and asserts the result is an object literal. */
function asObjectExpression(value: AstTypes.Expression): AstTypes.ObjectExpression {
	let node: AstTypes.Expression = value;
	while (node.type === 'TSSatisfiesExpression' || node.type === 'TSAsExpression') {
		node = node.expression;
	}
	if (node.type !== 'ObjectExpression') {
		throw new Error(
			'Expected the svelte config default export to be an object literal (e.g. `export default { ... }`)'
		);
	}
	return node;
}

/**
 * Returns (creating if needed) the object argument passed to `sveltekit(...)`.
 *
 * Reuses `vite.getConfig` so `defineConfig(...)` wrappers, arrow-function configs and
 * `satisfies`/`as` are handled, and scopes the lookup to the config's `plugins` array so the
 * real plugin call is edited rather than a stray `sveltekit()` elsewhere in the file.
 */
function sveltekitArg(ast: AstTypes.Program): AstTypes.ObjectExpression {
	const name = sveltekitLocalName(ast);

	const viteConfig = vite.getConfig(ast);
	const plugins = vite.configProperty(ast, viteConfig, {
		name: 'plugins',
		fallback: array.create()
	});

	let call: AstTypes.CallExpression | undefined;
	if (plugins.type === 'ArrayExpression') {
		call = plugins.elements.find(
			(el): el is AstTypes.CallExpression =>
				el?.type === 'CallExpression' && el.callee.type === 'Identifier' && el.callee.name === name
		);
	}
	// fall back to a broad search (e.g. plugins assembled via a variable or spread)
	call ??= findSveltekitCall(ast);
	// no call at all: scaffold one (the empty-`vite.config.js` fallback path from `edit`)
	if (!call) {
		imports.addNamed(ast, { imports: ['sveltekit'], from: '@sveltejs/kit/vite' });
		vite.addPlugin(ast, { code: 'sveltekit()' });
		call = findSveltekitCall(ast);
	}
	if (!call) {
		throw new Error('Unable to find a `sveltekit()` plugin call in the vite config');
	}

	let arg = call.arguments[0] as AstTypes.Expression | undefined;
	if (!arg || arg.type !== 'ObjectExpression') {
		arg = object.create({});
		call.arguments[0] = arg;
	}
	return arg as AstTypes.ObjectExpression;
}

/**
 * Resolves the svelte-level config object (the "root"):
 * - `svelte`: the default-exported object (created on demand if missing).
 * - `vite`: the object passed to `sveltekit(...)`.
 */
export function getConfigRoot(
	ast: AstTypes.Program,
	kind: SvelteConfigKind
): AstTypes.ObjectExpression {
	if (kind === 'svelte') {
		const { value } = exports.createDefault(ast, { fallback: object.create({}) });
		return asObjectExpression(value);
	}
	return sveltekitArg(ast);
}

/**
 * Resolves the kit-level config object from the root (created on demand if missing):
 * - `svelte`: the nested `kit` object.
 * - `vite`: the root itself (kit options are flattened onto the `sveltekit()` argument).
 */
export function getKitObject(
	root: AstTypes.ObjectExpression,
	kind: SvelteConfigKind
): AstTypes.ObjectExpression {
	if (kind === 'vite') return root;
	return object.property(root, { name: 'kit', fallback: object.create({}) });
}
