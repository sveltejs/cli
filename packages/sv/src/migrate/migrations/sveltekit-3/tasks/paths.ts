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
	const pathImports = importsFrom(programs, PATHS_MODULE);
	const typeImports = importsFrom(programs, TYPES_MODULE);
	if (pathImports.length === 0 && typeImports.length === 0) return false;

	const skippedIdentifiers = new Set<AstTypes.Identifier>();
	for (const declaration of [...pathImports, ...typeImports]) {
		for (const specifier of declaration.specifiers) {
			if (specifier.type !== 'ImportSpecifier') continue;
			if (specifier.imported.type === 'Identifier') skippedIdentifiers.add(specifier.imported);
			skippedIdentifiers.add(specifier.local);
		}
	}

	const baseLocals = importedLocals(pathImports, 'base');
	const assetsLocals = importedLocals(pathImports, 'assets');
	const resolveRouteLocals = importedLocals(pathImports, 'resolveRoute');
	const existingResolve = importAlias(programs, 'resolve', PATHS_MODULE);
	const existingAsset = importAlias(programs, 'asset', PATHS_MODULE);
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
	const shadowedIdentifiers = findShadowedIdentifiers(programs, fragment, [
		...baseLocals,
		...assetsLocals,
		...resolveRouteLocals,
		resolveLocal,
		assetLocal
	]);

	const resolveRouteCalls = new Set<AstTypes.CallExpression>();
	walkNodes(programs, fragment, {
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

	let changed = false;
	if (baseLocals.length > 0 || assetsLocals.length > 0) {
		changed = collapsePathPrefixes(
			programs,
			fragment,
			baseLocals,
			assetsLocals,
			resolveRouteLocals,
			resolveLocal,
			assetLocal,
			shadowedIdentifiers
		);
	}

	if (
		replaceIdentifiers(
			programs,
			fragment,
			baseLocals,
			() => js.functions.createCall({ name: resolveLocal, args: [''] }),
			shadowedIdentifiers
		)
	) {
		changed = true;
	}
	if (
		replaceIdentifiers(
			programs,
			fragment,
			assetsLocals,
			() => js.functions.createCall({ name: assetLocal, args: [''] }),
			shadowedIdentifiers
		)
	) {
		changed = true;
	}
	if (
		renameIdentifiers(
			programs,
			fragment,
			resolveRouteLocals,
			resolveLocal,
			skippedIdentifiers,
			shadowedIdentifiers
		)
	) {
		changed = true;
	}

	if (rewriteNamedImport(programs, PATHS_MODULE, 'assets', 'asset', assetLocal)) changed = true;
	if (rewriteNamedImport(programs, PATHS_MODULE, 'base', 'resolve', resolveLocal)) changed = true;
	if (rewriteNamedImport(programs, PATHS_MODULE, 'resolveRoute', 'resolve', resolveLocal)) {
		changed = true;
	}

	const renamedAsset = renameImportedType(
		programs,
		fragment,
		typeImports,
		'Asset',
		'AssetPath',
		skippedIdentifiers,
		shadowedIdentifiers
	);
	const renamedPath = renameImportedType(
		programs,
		fragment,
		typeImports,
		'Pathname',
		'Path',
		skippedIdentifiers,
		shadowedIdentifiers
	);
	if (renamedPath || renamedAsset) {
		changed = true;
	}

	if (
		normalizePathCalls(
			programs,
			fragment,
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

function importsFrom(programs: AstTypes.Program[], source: string): AstTypes.ImportDeclaration[] {
	return programs.flatMap((program) =>
		js.imports
			.findAll(program, { from: source })
			.flatMap((found) => (found.kind === 'static' ? [found.node] : []))
	);
}

function importAlias(programs: AstTypes.Program[], name: string, from: string): string | undefined {
	for (const program of programs) {
		const { alias } = js.imports.find(program, { name, from });
		if (alias !== undefined) return alias;
	}
}

function importedLocals(imports: AstTypes.ImportDeclaration[], name: string): string[] {
	return imports.flatMap((declaration) =>
		declaration.specifiers.flatMap((specifier) => {
			if (
				specifier.type !== 'ImportSpecifier' ||
				specifier.imported.type !== 'Identifier' ||
				specifier.imported.name !== name
			) {
				return [];
			}
			return [specifier.local.name];
		})
	);
}

function preferredReplacementLocal(locals: string[], replacement: string): string | undefined {
	const local = locals[0];
	if (!local) return undefined;
	return local === 'resolveRoute' ? replacement : local;
}

function collapsePathPrefixes(
	programs: AstTypes.Program[],
	fragment: SvelteAst.Fragment | undefined,
	baseLocals: string[],
	assetsLocals: string[],
	resolveRouteLocals: string[],
	resolveLocal: string,
	assetLocal: string,
	shadowedIdentifiers: Set<AstTypes.Identifier>
): boolean {
	let changed = false;

	walkNodes(programs, fragment, {
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

			replaceChildNode(ctx.path[ctx.path.length - 1], node, replacement);
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
				replaceChildNode(parent, node, onlyCall ? rest.expressions[0] : rest);
				changed = true;
				return;
			}

			replaceChildNode(
				parent,
				node,
				js.functions.createCall({ name: callee, args: [withoutLeadingSlash(rest)] })
			);
			changed = true;
		}
	});

	return changed;
}

/** Replace every `oldName` import from `from` with a single `newName as local` import. */
function rewriteNamedImport(
	programs: AstTypes.Program[],
	from: string,
	oldName: string,
	newName: string,
	local: string
): boolean {
	let changed = false;
	for (const program of programs) {
		const { statement } = js.imports.find(program, { name: oldName, from });
		if (!statement) continue;

		const isType =
			statement.importKind === 'type' ||
			statement.specifiers.some(
				(specifier) =>
					specifier.type === 'ImportSpecifier' &&
					specifier.imported.type === 'Identifier' &&
					specifier.imported.name === oldName &&
					(specifier as AstTypes.ImportSpecifier & { importKind?: 'type' | 'value' }).importKind ===
						'type'
			);

		// add first so the replacement lands in the existing declaration, keeping its position
		js.imports.addNamed(program, { imports: { [newName]: local }, from, isType });
		js.imports.remove(program, { name: oldName, from });
		// the add is skipped when the old import's local collides with the new one
		// (e.g. `resolveRoute as route` -> `resolve as route`), so retry now that it's gone
		js.imports.addNamed(program, { imports: { [newName]: local }, from, isType });
		changed = true;
	}
	return changed;
}

function renameImportedType(
	programs: AstTypes.Program[],
	fragment: SvelteAst.Fragment | undefined,
	imports: AstTypes.ImportDeclaration[],
	oldName: string,
	newName: string,
	skippedIdentifiers: Set<AstTypes.Identifier>,
	shadowedIdentifiers: Set<AstTypes.Identifier>
): boolean {
	const oldLocals = importedLocals(imports, oldName);
	if (oldLocals.length === 0) return false;

	const existingLocal = importAlias(programs, newName, TYPES_MODULE);
	const targetLocal =
		existingLocal ??
		(oldLocals[0] === oldName
			? availableImportLocal(programs, newName, `App${newName}`, oldLocals)
			: oldLocals[0]);
	renameIdentifiers(
		programs,
		fragment,
		oldLocals,
		targetLocal,
		skippedIdentifiers,
		shadowedIdentifiers
	);
	rewriteNamedImport(programs, TYPES_MODULE, oldName, newName, targetLocal);
	return true;
}

function availableImportLocal(
	programs: AstTypes.Program[],
	preferred: string,
	fallback: string,
	replacedLocals: string[]
): string {
	const bindings = topLevelBindings(programs);
	if (!bindings.has(preferred) || replacedLocals.includes(preferred)) return preferred;

	let local = fallback;
	let suffix = 2;
	while (bindings.has(local) && !replacedLocals.includes(local)) local = `${fallback}${suffix++}`;
	return local;
}

function topLevelBindings(programs: AstTypes.Program[]): Set<string> {
	const bindings = new Set<string>();
	for (const program of programs) {
		for (const statement of program.body) collectTopLevelBindings(statement, bindings);
	}
	return bindings;
}

function collectTopLevelBindings(node: AstTypes.Node, bindings: Set<string>): void {
	if (node.type === 'ImportDeclaration') {
		for (const specifier of node.specifiers) bindings.add(specifier.local.name);
	} else if (node.type === 'VariableDeclaration') {
		for (const declaration of node.declarations) collectPatternNames(declaration.id, bindings);
	} else if ((node.type === 'FunctionDeclaration' || node.type === 'ClassDeclaration') && node.id) {
		bindings.add(node.id.name);
	} else if (node.type === 'ExportNamedDeclaration' || node.type === 'ExportDefaultDeclaration') {
		if (node.declaration) collectTopLevelBindings(node.declaration as AstTypes.Node, bindings);
	} else if (
		['TSTypeAliasDeclaration', 'TSInterfaceDeclaration', 'TSEnumDeclaration'].includes(node.type)
	) {
		const id = (node as AstTypes.Node & { id?: AstTypes.Identifier }).id;
		if (id) bindings.add(id.name);
	}
}

function collectPatternNames(pattern: AstTypes.Pattern, names: Set<string>): void {
	if (pattern.type === 'Identifier') {
		names.add(pattern.name);
	} else if (pattern.type === 'RestElement') {
		collectPatternNames(pattern.argument, names);
	} else if (pattern.type === 'AssignmentPattern') {
		collectPatternNames(pattern.left, names);
	} else if (pattern.type === 'ArrayPattern') {
		for (const element of pattern.elements) if (element) collectPatternNames(element, names);
	} else if (pattern.type === 'ObjectPattern') {
		for (const property of pattern.properties) {
			collectPatternNames(
				property.type === 'RestElement' ? property.argument : property.value,
				names
			);
		}
	}
}

function findShadowedIdentifiers(
	programs: AstTypes.Program[],
	fragment: SvelteAst.Fragment | undefined,
	trackedNames: string[]
): Set<AstTypes.Identifier> {
	const tracked = new Set(trackedNames);
	const shadowed = new Set<AstTypes.Identifier>();
	const visitors: Parameters<typeof Walker.walk<AstTypes.Node, Set<string>>>[2] = {
		FunctionDeclaration(
			node: AstTypes.FunctionDeclaration,
			ctx: Walker.Context<AstTypes.Node, Set<string>>
		) {
			ctx.next(withScopedBindings(ctx.state, tracked, node.params, node.id));
		},
		FunctionExpression(
			node: AstTypes.FunctionExpression,
			ctx: Walker.Context<AstTypes.Node, Set<string>>
		) {
			ctx.next(withScopedBindings(ctx.state, tracked, node.params, node.id));
		},
		ArrowFunctionExpression(
			node: AstTypes.ArrowFunctionExpression,
			ctx: Walker.Context<AstTypes.Node, Set<string>>
		) {
			ctx.next(withScopedBindings(ctx.state, tracked, node.params));
		},
		BlockStatement(node: AstTypes.BlockStatement, ctx: Walker.Context<AstTypes.Node, Set<string>>) {
			const names = new Set<string>();
			for (const statement of node.body) {
				if (statement.type === 'VariableDeclaration') {
					for (const declaration of statement.declarations)
						collectPatternNames(declaration.id, names);
				} else if (
					(statement.type === 'FunctionDeclaration' || statement.type === 'ClassDeclaration') &&
					statement.id
				) {
					names.add(statement.id.name);
				}
			}
			ctx.next(withShadowedNames(ctx.state, tracked, names));
		},
		CatchClause(node: AstTypes.CatchClause, ctx: Walker.Context<AstTypes.Node, Set<string>>) {
			ctx.next(withScopedBindings(ctx.state, tracked, node.param ? [node.param] : []));
		},
		ForStatement(node: AstTypes.ForStatement, ctx: Walker.Context<AstTypes.Node, Set<string>>) {
			ctx.next(withLoopBindings(ctx.state, tracked, node.init));
		},
		ForInStatement(node: AstTypes.ForInStatement, ctx: Walker.Context<AstTypes.Node, Set<string>>) {
			ctx.next(withLoopBindings(ctx.state, tracked, node.left));
		},
		ForOfStatement(node: AstTypes.ForOfStatement, ctx: Walker.Context<AstTypes.Node, Set<string>>) {
			ctx.next(withLoopBindings(ctx.state, tracked, node.left));
		},
		Identifier(node: AstTypes.Identifier, ctx: Walker.Context<AstTypes.Node, Set<string>>) {
			if (ctx.state.has(node.name)) shadowed.add(node);
			ctx.next();
		}
	};
	const svelteVisitors = visitors as unknown as Record<
		string,
		(
			node: AstTypes.Node & {
				context?: AstTypes.Pattern;
				expression: AstTypes.Node;
				body: AstTypes.Node;
				fallback?: AstTypes.Node;
				parameters?: AstTypes.Pattern[];
			},
			ctx: Walker.Context<AstTypes.Node, Set<string>>
		) => void
	>;
	svelteVisitors.EachBlock = (node, ctx) => {
		const scoped = node.context
			? withScopedBindings(ctx.state, tracked, [node.context])
			: ctx.state;
		ctx.visit(node.expression, ctx.state);
		if (node.context) ctx.visit(node.context, scoped);
		ctx.visit(node.body, scoped);
		if (node.fallback) ctx.visit(node.fallback, ctx.state);
	};
	svelteVisitors.SnippetBlock = (node, ctx) => {
		ctx.next(withScopedBindings(ctx.state, tracked, node.parameters ?? []));
	};

	for (const program of programs) {
		Walker.walk(program as AstTypes.Node, new Set<string>(), visitors);
	}
	if (fragment) {
		Walker.walk(fragment as unknown as AstTypes.Node, new Set<string>(), visitors);
	}
	return shadowed;
}

function withScopedBindings(
	state: Set<string>,
	tracked: Set<string>,
	patterns: AstTypes.Pattern[],
	id?: AstTypes.Identifier | null
): Set<string> {
	const names = new Set<string>();
	if (id) names.add(id.name);
	for (const pattern of patterns) collectPatternNames(pattern, names);
	return withShadowedNames(state, tracked, names);
}

function withLoopBindings(
	state: Set<string>,
	tracked: Set<string>,
	declaration: AstTypes.Node | null | undefined
): Set<string> {
	if (declaration?.type !== 'VariableDeclaration') return state;
	const names = new Set<string>();
	for (const declarator of declaration.declarations) collectPatternNames(declarator.id, names);
	return withShadowedNames(state, tracked, names);
}

function withShadowedNames(
	state: Set<string>,
	tracked: Set<string>,
	names: Set<string>
): Set<string> {
	const scoped = new Set(state);
	for (const name of names) if (tracked.has(name)) scoped.add(name);
	return scoped;
}

function normalizePathCalls(
	programs: AstTypes.Program[],
	fragment: SvelteAst.Fragment | undefined,
	resolveLocal: string | undefined,
	assetLocal: string | undefined,
	resolveRouteCalls: Set<AstTypes.CallExpression>,
	shadowedIdentifiers: Set<AstTypes.Identifier>
): boolean {
	let changed = false;
	walkNodes(programs, fragment, {
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
	});
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

function renameIdentifiers(
	programs: AstTypes.Program[],
	fragment: SvelteAst.Fragment | undefined,
	locals: string[],
	replacement: string,
	skippedIdentifiers: Set<AstTypes.Identifier>,
	shadowedIdentifiers: Set<AstTypes.Identifier>
): boolean {
	let changed = false;
	walkNodes(programs, fragment, {
		Identifier(node: AstTypes.Identifier, ctx: Walker.Context<AstTypes.Node, null>) {
			const parent = ctx.path[ctx.path.length - 1];
			if (
				locals.includes(node.name) &&
				!skippedIdentifiers.has(node) &&
				!shadowedIdentifiers.has(node) &&
				!isNonComputedProperty(node, parent)
			) {
				node.name = replacement;
				if (parent.type === 'Property' && parent.value === node) parent.shorthand = false;
				changed = true;
			}
			ctx.next();
		}
	});
	return changed;
}

function replaceIdentifiers(
	programs: AstTypes.Program[],
	fragment: SvelteAst.Fragment | undefined,
	locals: string[],
	replacement: () => AstTypes.Expression,
	shadowedIdentifiers: Set<AstTypes.Identifier>
): boolean {
	let changed = false;
	walkNodes(programs, fragment, {
		Identifier(node: AstTypes.Identifier, ctx: Walker.Context<AstTypes.Node, null>) {
			const parent = ctx.path[ctx.path.length - 1];
			if (
				locals.includes(node.name) &&
				!shadowedIdentifiers.has(node) &&
				!isImportIdentifier(node, parent) &&
				parent.type !== 'ExportSpecifier' &&
				!isNonComputedProperty(node, parent)
			) {
				const shorthandValue = parent.type === 'Property' && parent.value === node;
				replaceChildNode(parent, node, replacement());
				if (shorthandValue) parent.shorthand = false;
				changed = true;
				return;
			}
			ctx.next();
		}
	});
	return changed;
}

function walkNodes(
	programs: AstTypes.Program[],
	fragment: SvelteAst.Fragment | undefined,
	visitors: Parameters<typeof Walker.walk<AstTypes.Node, null>>[2]
): void {
	for (const program of programs) Walker.walk(program as AstTypes.Node, null, visitors);
	if (fragment) Walker.walk(fragment as unknown as AstTypes.Node, null, visitors);
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
		expression.value = expression.value.slice(1);
		expression.raw = undefined;
		return true;
	}

	if (expression.type === 'TemplateLiteral') {
		const quasi = expression.quasis[0];
		if (!quasi?.value.raw.startsWith('/')) return false;
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

function isImportIdentifier(node: AstTypes.Identifier, parent: AstTypes.Node): boolean {
	return parent.type === 'ImportSpecifier' && (parent.imported === node || parent.local === node);
}

function isNonComputedProperty(node: AstTypes.Identifier, parent: AstTypes.Node): boolean {
	return (
		(parent.type === 'MemberExpression' && parent.property === node && !parent.computed) ||
		(parent.type === 'Property' && parent.key === node && !parent.computed) ||
		(parent.type === 'ExportSpecifier' && parent.exported === node)
	);
}

function replaceChildNode(
	parent: AstTypes.Node,
	oldNode: AstTypes.Node,
	newNode: AstTypes.Node
): void {
	for (const key of Object.keys(parent)) {
		const value = (parent as unknown as Record<string, unknown>)[key];
		if (value === oldNode) {
			(parent as unknown as Record<string, unknown>)[key] = newNode;
			return;
		}
		if (Array.isArray(value)) {
			const index = value.indexOf(oldNode);
			if (index !== -1) {
				value[index] = newNode;
				return;
			}
		}
	}
}
