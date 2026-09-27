import * as Walker from 'zimmerframe';
import type { AstTypes, SvelteAst } from '../index.ts';

type Root = AstTypes.Program | SvelteAst.Fragment;
type WalkNode = AstTypes.Node & Record<string, any>;

export function collectPatternNames(pattern: AstTypes.Pattern): string[] {
	const names: string[] = [];
	collectNames(pattern, names);
	return names;
}

export function topLevelBindings(programs: AstTypes.Program[]): Set<string> {
	const bindings = new Set<string>();
	for (const program of programs) {
		for (const statement of program.body) collectTopLevelBindings(statement as WalkNode, bindings);
	}
	return bindings;
}

export function nestedBindingNames(statements: AstTypes.Program['body']): Set<string> {
	const names = new Set<string>();
	for (const statement of statements) {
		const topLevel = new Set<WalkNode>([statement as WalkNode]);
		if (
			(statement.type === 'ExportNamedDeclaration' ||
				statement.type === 'ExportDefaultDeclaration') &&
			statement.declaration
		) {
			topLevel.add(statement.declaration as WalkNode);
		}
		forEachNode(statement as WalkNode, (node) => {
			switch (node.type) {
				case 'FunctionDeclaration':
				case 'ClassDeclaration':
					if (!topLevel.has(node) && node.id?.type === 'Identifier') names.add(node.id.name);
					if (node.type === 'FunctionDeclaration') addPatternNames(node.params, names);
					break;
				case 'FunctionExpression':
				case 'ArrowFunctionExpression':
					if (node.id?.type === 'Identifier') names.add(node.id.name);
					addPatternNames(node.params, names);
					break;
				case 'ClassExpression':
					if (node.id?.type === 'Identifier') names.add(node.id.name);
					break;
				case 'VariableDeclaration':
					if (!topLevel.has(node)) {
						for (const declaration of node.declarations) {
							addPatternNames([declaration.id], names);
						}
					}
					break;
				case 'CatchClause':
					if (node.param) addPatternNames([node.param], names);
					break;
			}
		});
	}
	return names;
}

export function findShadowedIdentifiers(roots: Root[], names: string[]): Set<AstTypes.Identifier> {
	const tracked = new Set(names);
	const shadowed = new Set<AstTypes.Identifier>();
	const visitors: Parameters<typeof Walker.walk<AstTypes.Node, Set<string>>>[2] = {
		FunctionDeclaration(node, ctx) {
			// a function declaration's id binds in the enclosing scope (nested declarations are
			// handled by the `BlockStatement` visitor), so only its parameters shadow inside
			ctx.next(withScopedBindings(ctx.state, tracked, node.params));
		},
		FunctionExpression(node, ctx) {
			// unlike a declaration, a function expression's id is only visible inside itself
			ctx.next(withScopedBindings(ctx.state, tracked, node.params, node.id));
		},
		ArrowFunctionExpression(node, ctx) {
			ctx.next(withScopedBindings(ctx.state, tracked, node.params));
		},
		BlockStatement(node, ctx) {
			ctx.next(withShadowedNames(ctx.state, tracked, blockBindings(node)));
		},
		CatchClause(node, ctx) {
			ctx.next(withScopedBindings(ctx.state, tracked, node.param ? [node.param] : []));
		},
		ForStatement(node, ctx) {
			ctx.next(withLoopBindings(ctx.state, tracked, node.init));
		},
		ForInStatement(node, ctx) {
			ctx.next(withLoopBindings(ctx.state, tracked, node.left));
		},
		ForOfStatement(node, ctx) {
			ctx.next(withLoopBindings(ctx.state, tracked, node.left));
		},
		Identifier(node, ctx) {
			if (ctx.state.has(node.name)) shadowed.add(node);
			ctx.next();
		}
	};
	const svelteVisitors = visitors as unknown as Record<
		string,
		(node: WalkNode, ctx: Walker.Context<AstTypes.Node, Set<string>>) => void
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
	svelteVisitors.AwaitBlock = (node, ctx) => {
		ctx.visit(node.expression, ctx.state);
		if (node.pending) ctx.visit(node.pending, ctx.state);
		if (node.then) {
			const scoped = node.value ? withScopedBindings(ctx.state, tracked, [node.value]) : ctx.state;
			if (node.value) ctx.visit(node.value, scoped);
			ctx.visit(node.then, scoped);
		}
		if (node.catch) {
			const scoped = node.error ? withScopedBindings(ctx.state, tracked, [node.error]) : ctx.state;
			if (node.error) ctx.visit(node.error, scoped);
			ctx.visit(node.catch, scoped);
		}
	};

	for (const root of roots) {
		Walker.walk(root as AstTypes.Node, new Set<string>(), visitors);
	}
	return shadowed;
}
function collectNames(pattern: AstTypes.Pattern, names: string[]): void {
	if (pattern.type === 'Identifier') {
		names.push(pattern.name);
	} else if (pattern.type === 'RestElement') {
		collectNames(pattern.argument, names);
	} else if (pattern.type === 'AssignmentPattern') {
		collectNames(pattern.left, names);
	} else if (pattern.type === 'ArrayPattern') {
		for (const element of pattern.elements) if (element) collectNames(element, names);
	} else if (pattern.type === 'ObjectPattern') {
		for (const property of pattern.properties) {
			collectNames(property.type === 'RestElement' ? property.argument : property.value, names);
		}
	}
}

function collectTopLevelBindings(node: WalkNode, bindings: Set<string>): void {
	if (node.type === 'ImportDeclaration') {
		for (const specifier of node.specifiers) bindings.add(specifier.local.name);
	} else if (node.type === 'VariableDeclaration') {
		for (const declaration of node.declarations) addPatternNames([declaration.id], bindings);
	} else if ((node.type === 'FunctionDeclaration' || node.type === 'ClassDeclaration') && node.id) {
		bindings.add(node.id.name);
	} else if (node.type === 'ExportNamedDeclaration' || node.type === 'ExportDefaultDeclaration') {
		if (node.declaration) collectTopLevelBindings(node.declaration as WalkNode, bindings);
	} else if (
		[
			'TSTypeAliasDeclaration',
			'TSInterfaceDeclaration',
			'TSEnumDeclaration',
			'TSModuleDeclaration'
		].includes(node.type)
	) {
		if (node.id?.type === 'Identifier') bindings.add(node.id.name);
	}
}

function blockBindings(node: AstTypes.BlockStatement): Set<string> {
	const names = new Set<string>();
	for (const statement of node.body) {
		if (statement.type === 'VariableDeclaration') {
			for (const declaration of statement.declarations) addPatternNames([declaration.id], names);
		} else if (
			(statement.type === 'FunctionDeclaration' || statement.type === 'ClassDeclaration') &&
			statement.id
		) {
			names.add(statement.id.name);
		}
	}
	return names;
}

function addPatternNames(patterns: AstTypes.Pattern[], names: Set<string>): void {
	for (const pattern of patterns) {
		for (const name of collectPatternNames(pattern)) names.add(name);
	}
}

function withScopedBindings(
	state: Set<string>,
	tracked: Set<string>,
	patterns: AstTypes.Pattern[],
	id?: AstTypes.Identifier | null
): Set<string> {
	const names = new Set<string>();
	if (id) names.add(id.name);
	addPatternNames(patterns, names);
	return withShadowedNames(state, tracked, names);
}

function withLoopBindings(
	state: Set<string>,
	tracked: Set<string>,
	declaration: AstTypes.Node | null | undefined
): Set<string> {
	if (declaration?.type !== 'VariableDeclaration') return state;
	const names = new Set<string>();
	for (const declarator of declaration.declarations) addPatternNames([declarator.id], names);
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

function forEachNode(node: WalkNode, visit: (node: WalkNode) => void): void {
	visit(node);
	for (const [key, value] of Object.entries(node)) {
		if (key === 'loc' || key === 'range') continue;
		if (Array.isArray(value)) {
			for (const child of value) if (isNode(child)) forEachNode(child, visit);
		} else if (isNode(value)) {
			forEachNode(value, visit);
		}
	}
}

function isNode(value: unknown): value is WalkNode {
	return (
		typeof value === 'object' && value !== null && typeof (value as WalkNode).type === 'string'
	);
}
