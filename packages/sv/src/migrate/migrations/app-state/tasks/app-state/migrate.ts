import { Walker, js, type AstTypes, type Comments, type SvelteAst } from '@sveltejs/sv-utils';
import { addMigrationTask } from '../../../../migration-task.ts';

const OLD_SOURCE = '$app/stores';
const NEW_SOURCE = '$app/state';

const NAVIGATING_REVIEW_MESSAGE =
	'`navigating` is always defined now - review this usage; use `navigating.to` for the pending navigation';

/** Stores exported from `$app/stores` that we know how to migrate. */
const KNOWN_STORES = new Set(['page', 'navigating', 'updated', 'getStores']);

type StoreLocal = {
	/** the local identifier name, e.g. `page` or an alias like `_page` */
	name: string;
	/** the original `$app/stores` export name */
	store: string;
};

/**
 * Migrate `$app/stores` usage to `$app/state` in one Svelte component.
 * Returns whether anything changed.
 */
export function migrateAppState(ast: AstTypes.Program, fragment: SvelteAst.Fragment): boolean {
	const imports = js.imports
		.findAll(ast, { from: OLD_SOURCE })
		.filter((found) => found.kind === 'static');
	if (imports.length === 0) return false;

	const locals = new Map<string, StoreLocal>();
	for (const binding of js.imports.bindings(ast, { from: OLD_SOURCE })) {
		if (!KNOWN_STORES.has(binding.imported)) continue;
		locals.set(`$${binding.local}`, { name: binding.local, store: binding.imported });
	}
	if (locals.size === 0) return false;

	// some patterns can't be safely auto-migrated - flag them and leave the file untouched
	const bailReason = findBailReason(ast, locals);
	if (bailReason) {
		addMigrationTask(
			`could not auto-migrate \`${OLD_SOURCE}\` to \`${NEW_SOURCE}\`: ${bailReason}; migrate manually`,
			{ fragment }
		);
		return true;
	}

	// rename the import source(s)
	for (const found of imports) {
		js.imports.setSource(found, NEW_SOURCE);
	}

	const state = { needsNavigatingReview: false };
	derefStores(ast, locals, state);
	derefStores(fragment, locals, state);

	if (state.needsNavigatingReview) {
		addMigrationTask(NAVIGATING_REVIEW_MESSAGE, { fragment });
	}

	return true;
}

type DerefState = { needsNavigatingReview: boolean };

/**
 * Migrate `$app/stores` usage in a `.svelte.ts` / `.svelte.js` module.
 *
 * Modules never used the `$store` auto-subscription syntax, so the only mechanical change is
 * renaming the import. `.subscribe(...)` / `get(store)` reactivity can't be auto-ported to runes,
 * so those are flagged for manual follow-up. Returns whether anything changed.
 */
export function migrateAppStateModule(ast: AstTypes.Program, comments: Comments): boolean {
	const imports = js.imports
		.findAll(ast, { from: OLD_SOURCE })
		.filter((found) => found.kind === 'static');
	if (imports.length === 0) return false;

	const storeNames = new Set<string>();
	let getStoresImport: AstTypes.ImportDeclaration | undefined;
	for (const binding of js.imports.bindings(ast, { from: OLD_SOURCE })) {
		if (!KNOWN_STORES.has(binding.imported)) continue;
		if (binding.imported === 'getStores') getStoresImport = binding.declaration;
		else storeNames.add(binding.local);
	}
	if (storeNames.size === 0 && !getStoresImport) return false;

	for (const found of imports) {
		js.imports.setSource(found, NEW_SOURCE);
	}

	if (getStoresImport) {
		addMigrationTask('`getStores()` is not available; migrate manually', {
			comments,
			node: getStoresImport
		});
	}

	Walker.walk(ast as AstTypes.Node, null, {
		MemberExpression(node, ctx) {
			if (
				node.object.type === 'Identifier' &&
				storeNames.has(node.object.name) &&
				node.property.type === 'Identifier' &&
				node.property.name === 'subscribe'
			) {
				addMigrationTask(
					'convert `' + node.object.name + '.subscribe(...)` to a rune (`$derived`/`$effect`)',
					{ comments, node: enclosingStatement(ctx.path) ?? node }
				);
			}
			ctx.next();
		},
		CallExpression(node, ctx) {
			if (
				node.callee.type === 'Identifier' &&
				node.callee.name === 'get' &&
				node.arguments[0]?.type === 'Identifier' &&
				storeNames.has(node.arguments[0].name)
			) {
				addMigrationTask(
					'replace `get(' +
						node.arguments[0].name +
						')` - read the value directly (no longer a store)',
					{ comments, node: enclosingStatement(ctx.path) ?? node }
				);
			}
			ctx.next();
		}
	});

	return true;
}

function enclosingStatement(path: readonly AstTypes.Node[]): AstTypes.Node | undefined {
	for (let i = path.length - 1; i >= 0; i -= 1) {
		const node = path[i];
		if (
			node.type === 'VariableDeclaration' ||
			node.type === 'ExpressionStatement' ||
			node.type === 'ReturnStatement'
		) {
			return node;
		}
	}
}

/**
 * Detect usage that can't be mechanically migrated. Returns a human-readable reason, or
 * `undefined` when the file is safe to migrate.
 */
function findBailReason(
	ast: AstTypes.Program,
	locals: Map<string, StoreLocal>
): string | undefined {
	for (const local of locals.values()) {
		if (local.store === 'getStores') return '`getStores()` is not available';
	}

	const storeNames = new Set([...locals.values()].map((local) => local.name));
	let reason: string | undefined;

	Walker.walk(ast as AstTypes.Node, null, {
		LabeledStatement(node, ctx) {
			if (node.label.name === '$') reason ??= 'legacy reactive statement (`$:`)';
			ctx.next();
		},
		ExportNamedDeclaration(node, ctx) {
			if (node.declaration?.type === 'VariableDeclaration' && node.declaration.kind === 'let') {
				reason ??= 'legacy `export let` props';
			}
			ctx.next();
		},
		CallExpression(node, ctx) {
			if (
				node.callee.type === 'Identifier' &&
				node.callee.name === 'derived' &&
				node.arguments[0]?.type === 'Identifier' &&
				storeNames.has(node.arguments[0].name)
			) {
				reason ??= '`derived(...)` store';
			}
			ctx.next();
		}
	});

	return reason;
}

/** Rewrite `$store` auto-subscription identifiers to their `$app/state` equivalent. */
function derefStores(
	node: AstTypes.Node | SvelteAst.SvelteNode,
	locals: Map<string, StoreLocal>,
	state: DerefState
): void {
	Walker.walk(node as AstTypes.Node, null, {
		Identifier(node, ctx) {
			const local = locals.get(node.name);
			if (local === undefined) return;

			const parent = ctx.path[ctx.path.length - 1];
			if (!js.identifiers.isReference(node, parent)) return;

			// `{ $page }` shorthand carries the name twice; keep the key and rewrite only the value
			if (parent.type === 'Property' && parent.shorthand && parent.key === node) {
				parent.key = { ...node };
				parent.shorthand = false;
			}

			if (local.store === 'updated') {
				// `$updated` -> `updated.current`
				js.common.replaceChild(parent, node, memberExpression(local.name, 'current'));
				return;
			}

			if (local.store === 'navigating') {
				if (isBooleanPosition(node, parent)) {
					// `$navigating` used as a truthy check -> `navigating.to`
					// (`navigating` is always defined now; `.to` is null when idle)
					js.common.replaceChild(parent, node, memberExpression(local.name, 'to'));
					return;
				}
				if (!isMemberAccessObject(node, parent)) {
					// bare `$navigating` in a non-boolean, non-member position is ambiguous
					// (was rendering/passing the store value) - flag for manual review
					state.needsNavigatingReview = true;
				}
			}

			// `$page` -> `page`, `$navigating.to` -> `navigating.to`, etc.
			node.name = local.name;
		}
	});
}

/** Whether `node` is the object being accessed in `parent` (e.g. `$navigating` in `$navigating.to`). */
function isMemberAccessObject(
	node: AstTypes.Node,
	parent: AstTypes.Node | SvelteAst.SvelteNode
): boolean {
	return parent.type === 'MemberExpression' && parent.object === node;
}

/**
 * Whether `node` sits in a boolean (truthiness-tested) position, where a bare
 * `navigating` should become `navigating.to`.
 */
function isBooleanPosition(
	node: AstTypes.Node,
	parent: AstTypes.Node | SvelteAst.SvelteNode
): boolean {
	switch (parent.type) {
		// `{#if x}`, `{:else if x}`, `if (x)`, `while (x)`, `x ? a : b`
		case 'IfBlock':
		case 'IfStatement':
		case 'WhileStatement':
		case 'DoWhileStatement':
		case 'ConditionalExpression':
			return (parent as { test?: AstTypes.Node }).test === node;
		// `!x`
		case 'UnaryExpression':
			return parent.operator === '!' && parent.argument === node;
		// `x && ...`, `x || ...` (left operand is truthiness-tested)
		case 'LogicalExpression':
			return (parent.operator === '&&' || parent.operator === '||') && parent.left === node;
		default:
			return false;
	}
}

function memberExpression(object: string, property: string): AstTypes.MemberExpression {
	return {
		type: 'MemberExpression',
		object: { type: 'Identifier', name: object },
		property: { type: 'Identifier', name: property },
		computed: false,
		optional: false
	};
}
