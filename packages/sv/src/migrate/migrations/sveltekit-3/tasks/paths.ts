import { js, transforms, Walker, type AstTypes, type SvelteAst } from '@sveltejs/sv-utils';
import { defineMigrationTask } from '../../../index.ts';

const PATHS_MODULE = '$app/paths';
const TYPES_MODULE = '$app/types';

export default defineMigrationTask({
	id: 'paths',
	description: 'Migrate deprecated $app/paths APIs and path types',
	run: ({ sv }) => {
		sv.files(
			{
				include: '**/*.{js,ts,svelte}',
				where: (content) => content.includes(PATHS_MODULE) || content.includes(TYPES_MODULE)
			},
			(content, file) => {
				if (file.endsWith('.svelte')) {
					return transforms.svelte(({ ast }) => {
						const programs: AstTypes.Program[] = [];
						if (ast.module) programs.push(ast.module.content);
						if (ast.instance) programs.push(ast.instance.content);
						if (!migratePaths(programs, ast.fragment)) return false;
					})(content);
				}

				return transforms.script(({ ast }) => {
					if (!migratePaths([ast])) return false;
				})(content);
			}
		);
	}
});

function migratePaths(programs: AstTypes.Program[], fragment?: SvelteAst.Fragment): boolean {
	const roots: Array<AstTypes.Program | SvelteAst.Fragment> = fragment
		? [...programs, fragment]
		: programs;
	const pathBindings = programs.flatMap((program) =>
		js.imports.bindings(program, { from: PATHS_MODULE })
	);
	const typeBindings = programs.flatMap((program) =>
		js.imports.bindings(program, { from: TYPES_MODULE })
	);
	if (pathBindings.length === 0 && typeBindings.length === 0) return false;

	const baseLocals = importedLocals(pathBindings, 'base');
	const assetsLocals = importedLocals(pathBindings, 'assets');
	const resolveRouteLocals = importedLocals(pathBindings, 'resolveRoute');
	const existingResolve = importAlias(pathBindings, 'resolve');
	const existingAsset = importAlias(pathBindings, 'asset');
	const needsResolve = baseLocals.length > 0 || resolveRouteLocals.length > 0;
	const needsAsset = assetsLocals.length > 0;
	const resolveLocal =
		existingResolve ??
		preferredReplacementLocal(resolveRouteLocals, 'resolve') ??
		availableImportLocal(programs, 'resolve', 'resolvePath', [
			...baseLocals,
			...resolveRouteLocals
		]);
	const assetLocal =
		existingAsset ?? availableImportLocal(programs, 'asset', 'assetPath', assetsLocals);
	const shadowedIdentifiers = js.scope.findShadowedIdentifiers(roots, [
		...baseLocals,
		...assetsLocals,
		...resolveRouteLocals,
		resolveLocal,
		assetLocal
	]);

	const resolveRouteCalls = new Set<AstTypes.CallExpression>();
	for (const root of roots) {
		Walker.walk(root as unknown as AstTypes.Node, null, {
			CallExpression(node: AstTypes.CallExpression, ctx: Walker.Context<AstTypes.Node, null>) {
				if (
					isNamedIdentifier(node.callee, resolveRouteLocals) &&
					!shadowedIdentifiers.has(node.callee)
				) {
					resolveRouteCalls.add(node);
				}
				ctx.next();
			}
		});
	}

	let changed = false;
	if (baseLocals.length > 0 || assetsLocals.length > 0) {
		changed = collapsePathPrefixes(
			roots,
			baseLocals,
			assetsLocals,
			resolveRouteLocals,
			resolveLocal,
			assetLocal,
			shadowedIdentifiers
		);
	}

	if (
		js.identifiers.replaceReferences(roots, baseLocals, () =>
			js.functions.createCall({ name: resolveLocal, args: [''] })
		)
	) {
		changed = true;
	}
	if (
		js.identifiers.replaceReferences(roots, assetsLocals, () =>
			js.functions.createCall({ name: assetLocal, args: [''] })
		)
	) {
		changed = true;
	}
	if (
		js.imports.renameBinding(roots, {
			from: PATHS_MODULE,
			name: 'assets',
			to: 'asset',
			local: assetLocal
		})
	) {
		changed = true;
	}
	if (
		js.imports.renameBinding(roots, {
			from: PATHS_MODULE,
			name: 'base',
			to: 'resolve',
			local: resolveLocal
		})
	) {
		changed = true;
	}
	if (
		js.imports.renameBinding(roots, {
			from: PATHS_MODULE,
			name: 'resolveRoute',
			to: 'resolve',
			local: resolveLocal
		})
	) {
		changed = true;
	}

	const renamedAsset = renameImportedType(programs, roots, typeBindings, 'Asset', 'AssetPath');
	const renamedPath = renameImportedType(programs, roots, typeBindings, 'Pathname', 'Path');
	if (renamedPath || renamedAsset) {
		changed = true;
	}

	if (
		normalizePathCalls(
			roots,
			// only normalize calls to names that are actually imported from `$app/paths`,
			// so unrelated globals sharing the same name are left untouched
			existingResolve !== undefined || needsResolve ? resolveLocal : undefined,
			existingAsset !== undefined || needsAsset ? assetLocal : undefined,
			resolveRouteCalls,
			shadowedIdentifiers
		)
	)
		changed = true;

	return changed;
}

function importAlias(bindings: js.imports.ImportBinding[], name: string): string | undefined {
	return bindings.find((binding) => binding.imported === name)?.local;
}

function importedLocals(bindings: js.imports.ImportBinding[], name: string): string[] {
	return bindings
		.filter((binding) => binding.kind === 'named' && binding.imported === name)
		.map((binding) => binding.local);
}

function preferredReplacementLocal(locals: string[], replacement: string): string | undefined {
	const local = locals[0];
	if (!local) return undefined;
	return local === 'resolveRoute' ? replacement : local;
}

function collapsePathPrefixes(
	roots: Array<AstTypes.Program | SvelteAst.Fragment>,
	baseLocals: string[],
	assetsLocals: string[],
	resolveRouteLocals: string[],
	resolveLocal: string,
	assetLocal: string,
	shadowedIdentifiers: Set<AstTypes.Identifier>
): boolean {
	let changed = false;

	const visitors: Parameters<typeof Walker.walk<AstTypes.Node, null>>[2] = {
		BinaryExpression(node: AstTypes.BinaryExpression, ctx: Walker.Context<AstTypes.Node, null>) {
			if (
				node.operator !== '+' ||
				node.left.type !== 'Identifier' ||
				shadowedIdentifiers.has(node.left)
			) {
				ctx.next();
				return;
			}

			let replacement: AstTypes.Expression | undefined;
			if (baseLocals.includes(node.left.name)) {
				replacement = isResolveRouteCall(node.right, resolveRouteLocals, shadowedIdentifiers)
					? node.right
					: js.functions.createCall({
							name: resolveLocal,
							args: [withoutLeadingSlash(node.right)]
						});
			} else if (assetsLocals.includes(node.left.name)) {
				replacement = js.functions.createCall({
					name: assetLocal,
					args: [withoutLeadingSlash(node.right)]
				});
			}

			if (!replacement) {
				ctx.next();
				return;
			}

			js.common.replaceChild(ctx.path[ctx.path.length - 1], node, replacement);
			changed = true;
		},
		TemplateLiteral(node: AstTypes.TemplateLiteral, ctx: Walker.Context<AstTypes.Node, null>) {
			const first = node.expressions[0];
			const parent = ctx.path[ctx.path.length - 1];
			if (
				first?.type !== 'Identifier' ||
				shadowedIdentifiers.has(first) ||
				node.quasis[0]?.value.raw !== '' ||
				(parent.type === 'TaggedTemplateExpression' && parent.quasi === node)
			) {
				ctx.next();
				return;
			}

			let callee: string | undefined;
			if (baseLocals.includes(first.name)) callee = resolveLocal;
			if (assetsLocals.includes(first.name)) callee = assetLocal;
			if (!callee) {
				ctx.next();
				return;
			}

			const rest: AstTypes.TemplateLiteral = {
				type: 'TemplateLiteral',
				expressions: node.expressions.slice(1),
				quasis: node.quasis.slice(1)
			};

			// `${base}${resolveRoute(...)}...` — `resolve(...)` already includes the base
			// path, so drop the `base` prefix instead of wrapping in another call
			if (
				baseLocals.includes(first.name) &&
				rest.quasis[0]?.value.raw === '' &&
				rest.expressions[0] &&
				isResolveRouteCall(rest.expressions[0], resolveRouteLocals, shadowedIdentifiers)
			) {
				const onlyCall =
					rest.expressions.length === 1 && rest.quasis.every((quasi) => quasi.value.raw === '');
				js.common.replaceChild(parent, node, onlyCall ? rest.expressions[0] : rest);
				changed = true;
				return;
			}

			js.common.replaceChild(
				parent,
				node,
				js.functions.createCall({ name: callee, args: [withoutLeadingSlash(rest)] })
			);
			changed = true;
		}
	};
	for (const root of roots) Walker.walk(root as unknown as AstTypes.Node, null, visitors);

	return changed;
}

function renameImportedType(
	programs: AstTypes.Program[],
	roots: Array<AstTypes.Program | SvelteAst.Fragment>,
	bindings: js.imports.ImportBinding[],
	oldName: string,
	newName: string
): boolean {
	const oldLocals = importedLocals(bindings, oldName);
	if (oldLocals.length === 0) return false;

	const existingLocal = importAlias(bindings, newName);
	const targetLocal =
		existingLocal ??
		(oldLocals[0] === oldName
			? availableImportLocal(programs, newName, `App${newName}`, oldLocals)
			: oldLocals[0]);
	return js.imports.renameBinding(roots, {
		from: TYPES_MODULE,
		name: oldName,
		to: newName,
		local: targetLocal
	});
}

function availableImportLocal(
	programs: AstTypes.Program[],
	preferred: string,
	fallback: string,
	replacedLocals: string[]
): string {
	const bindings = js.scope.topLevelBindings(programs);
	for (const local of replacedLocals) bindings.delete(local);
	if (!bindings.has(preferred) || replacedLocals.includes(preferred)) return preferred;
	return js.identifiers.uniqueName(fallback, bindings);
}

function normalizePathCalls(
	roots: Array<AstTypes.Program | SvelteAst.Fragment>,
	resolveLocal: string | undefined,
	assetLocal: string | undefined,
	resolveRouteCalls: Set<AstTypes.CallExpression>,
	shadowedIdentifiers: Set<AstTypes.Identifier>
): boolean {
	let changed = false;
	const visitors: Parameters<typeof Walker.walk<AstTypes.Node, null>>[2] = {
		CallExpression(node: AstTypes.CallExpression, ctx: Walker.Context<AstTypes.Node, null>) {
			const argument = node.arguments[0];
			if (!argument || argument.type === 'SpreadElement') {
				ctx.next();
				return;
			}

			const isAsset =
				assetLocal !== undefined &&
				node.callee.type === 'Identifier' &&
				node.callee.name === assetLocal;
			// single-argument `resolve()` calls take a pathname, unless the argument
			// looks like a route id (e.g. `/(group)/about` or `/[[lang]]/home`)
			const isPathname =
				resolveLocal !== undefined &&
				node.callee.type === 'Identifier' &&
				node.callee.name === resolveLocal &&
				node.arguments.length === 1 &&
				!resolveRouteCalls.has(node) &&
				!looksLikeRouteId(argument);
			if (
				(isAsset || isPathname) &&
				node.callee.type === 'Identifier' &&
				!shadowedIdentifiers.has(node.callee) &&
				removeStaticLeadingSlash(argument)
			) {
				changed = true;
			}
			ctx.next();
		}
	};
	for (const root of roots) Walker.walk(root as unknown as AstTypes.Node, null, visitors);
	return changed;
}

function looksLikeRouteId(expression: AstTypes.Expression): boolean {
	if (expression.type === 'Literal' && typeof expression.value === 'string') {
		return /[[(]/.test(expression.value);
	}
	if (expression.type === 'TemplateLiteral') {
		return expression.quasis.some((quasi) => /[[(]/.test(quasi.value.raw));
	}
	return false;
}

function withoutLeadingSlash(expression: AstTypes.Expression): AstTypes.Expression {
	if (removeStaticLeadingSlash(expression)) return expression;
	return {
		type: 'CallExpression',
		callee: {
			type: 'MemberExpression',
			object: expression,
			property: { type: 'Identifier', name: 'slice' },
			computed: false,
			optional: false
		},
		arguments: [js.common.createLiteral(1)],
		optional: false
	};
}

function removeStaticLeadingSlash(expression: AstTypes.Expression): boolean {
	if (expression.type === 'Literal' && typeof expression.value === 'string') {
		if (!expression.value.startsWith('/')) return false;
		if (expression.value === '/') return false;
		expression.value = expression.value.slice(1);
		expression.raw = undefined;
		return true;
	}

	if (expression.type === 'TemplateLiteral') {
		const quasi = expression.quasis[0];
		if (!quasi?.value.raw.startsWith('/')) return false;
		if (quasi.value.raw === '/') return false;
		quasi.value.raw = quasi.value.raw.slice(1);
		if (quasi.value.cooked !== undefined && quasi.value.cooked !== null) {
			quasi.value.cooked = quasi.value.cooked.slice(1);
		}
		return true;
	}

	return false;
}

function isResolveRouteCall(
	expression: AstTypes.Expression,
	resolveRouteLocals: string[],
	shadowedIdentifiers: Set<AstTypes.Identifier>
): expression is AstTypes.CallExpression {
	return (
		expression.type === 'CallExpression' &&
		isNamedIdentifier(expression.callee, resolveRouteLocals) &&
		!shadowedIdentifiers.has(expression.callee)
	);
}

function isNamedIdentifier(node: AstTypes.Node, names: string[]): node is AstTypes.Identifier {
	return node.type === 'Identifier' && names.includes(node.name);
}
