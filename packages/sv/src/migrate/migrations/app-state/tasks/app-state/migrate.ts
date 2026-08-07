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
	for (const found of imports) {
		for (const [key, value] of collectStoreLocals(found.node)) locals.set(key, value);
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
		found.sourceNode.value = NEW_SOURCE;
		found.sourceNode.raw = undefined;
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
	for (const found of imports) {
		for (const specifier of found.node.specifiers) {
			if (specifier.type !== 'ImportSpecifier') continue;
			if (specifier.imported.type !== 'Identifier') continue;
			if (!KNOWN_STORES.has(specifier.imported.name)) continue;
			if (specifier.local?.type !== 'Identifier') continue;

			if (specifier.imported.name === 'getStores') getStoresImport = found.node;
			else storeNames.add(specifier.local.name);
		}
	}
	if (storeNames.size === 0 && !getStoresImport) return false;

	for (const found of imports) {
		found.sourceNode.value = NEW_SOURCE;
		found.sourceNode.raw = undefined;
	}

	if (getStoresImport) {
		addMigrationTask('`getStores()` is not available; migrate manually', {
			comments,
			node: getStoresImport
		});
	}

	Walker.walk(ast as AstTypes.Node, null, {
		MemberExpression(node: AstTypes.MemberExpression, ctx: Walker.Context<AstTypes.Node, null>) {
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
		CallExpression(node: AstTypes.CallExpression, ctx: Walker.Context<AstTypes.Node, null>) {
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
		LabeledStatement(node: AstTypes.LabeledStatement, ctx: Walker.Context<AstTypes.Node, null>) {
			if (node.label.name === '$') reason ??= 'legacy reactive statement (`$:`)';
			ctx.next();
		},
		ExportNamedDeclaration(
			node: AstTypes.ExportNamedDeclaration,
			ctx: Walker.Context<AstTypes.Node, null>
		) {
			if (node.declaration?.type === 'VariableDeclaration' && node.declaration.kind === 'let') {
				reason ??= 'legacy `export let` props';
			}
			ctx.next();
		},
		CallExpression(node: AstTypes.CallExpression, ctx: Walker.Context<AstTypes.Node, null>) {
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

/** Map of `$`-prefixed auto-subscription name -> store info. */
function collectStoreLocals(importNode: AstTypes.ImportDeclaration): Map<string, StoreLocal> {
	const locals = new Map<string, StoreLocal>();

	for (const specifier of importNode.specifiers) {
		if (specifier.type !== 'ImportSpecifier') continue;
		if (specifier.imported.type !== 'Identifier') continue;
		if (!KNOWN_STORES.has(specifier.imported.name)) continue;
		if (specifier.local?.type !== 'Identifier') continue;

		locals.set(`$${specifier.local.name}`, {
			name: specifier.local.name,
			store: specifier.imported.name
		});
	}

	return locals;
}

/** Rewrite `$store` auto-subscription identifiers to their `$app/state` equivalent. */
function derefStores(
	node: AstTypes.Node | SvelteAst.SvelteNode,
	locals: Map<string, StoreLocal>,
	state: DerefState
): void {
	Walker.walk(node as AstTypes.Node, null, {
		Identifier(node: AstTypes.Identifier, ctx: Walker.Context<AstTypes.Node, null>) {
			const local = locals.get(node.name);
			if (local === undefined) return;

			const parent = ctx.path[ctx.path.length - 1];

			if (local.store === 'updated') {
				// `$updated` -> `updated.current`
				replaceChildNode(parent, node, memberExpression(local.name, 'current'));
				return;
			}

			if (local.store === 'navigating') {
				if (isBooleanPosition(node, parent)) {
					// `$navigating` used as a truthy check -> `navigating.to`
					// (`navigating` is always defined now; `.to` is null when idle)
					replaceChildNode(parent, node, memberExpression(local.name, 'to'));
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

/** Replace `node` with `replacement` wherever it appears among `parent`'s direct children. */
function replaceChildNode(
	parent: AstTypes.Node | SvelteAst.SvelteNode,
	node: AstTypes.Node,
	replacement: AstTypes.Node
): void {
	const record = parent as unknown as Record<string, unknown>;

	for (const key in record) {
		const value = record[key];

		if (value === node) {
			record[key] = replacement;
			return;
		}

		if (Array.isArray(value)) {
			const index = value.indexOf(node);
			if (index !== -1) {
				value[index] = replacement;
				return;
			}
		}
	}
}
