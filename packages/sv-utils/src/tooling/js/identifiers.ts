import * as Walker from 'zimmerframe';
import type { AstTypes, SvelteAst } from '../index.ts';
import { replaceChild } from './common.ts';
import { findShadowedIdentifiers } from './scope.ts';

type Root = AstTypes.Program | SvelteAst.Fragment;

export function isReference(
	node: AstTypes.Node,
	parent: AstTypes.Node | SvelteAst.SvelteNode | undefined
): boolean {
	if (!parent) return true;
	if (parent.type === 'MemberExpression') return parent.computed || parent.object === node;
	if (parent.type === 'Property') return parent.computed || parent.shorthand || parent.key !== node;
	if (
		(parent.type === 'PropertyDefinition' || parent.type === 'MethodDefinition') &&
		parent.key === node
	) {
		return parent.computed;
	}
	if (parent.type === 'ImportSpecifier' && parent.imported === node) return false;
	if (parent.type === 'ExportSpecifier' && parent.exported === node) return false;
	if (parent.type === 'MetaProperty') return false;
	if (
		(parent.type === 'LabeledStatement' ||
			parent.type === 'BreakStatement' ||
			parent.type === 'ContinueStatement') &&
		parent.label === node
	) {
		return false;
	}
	return true;
}

export function uniqueName(base: string, used: Set<string>): string {
	let name = base;
	let counter = 2;
	while (used.has(name)) name = `${base}${counter++}`;
	used.add(name);
	return name;
}

export function renameReferences(roots: Root[], renames: Map<string, string>): boolean {
	if (renames.size === 0) return false;
	const shadowed = findShadowedIdentifiers(roots, [...renames.keys()]);
	let changed = false;

	walkRoots(roots, {
		Property(node, ctx) {
			const value = node.value.type === 'AssignmentPattern' ? node.value.left : node.value;
			if (
				node.shorthand &&
				value.type === 'Identifier' &&
				renames.has(value.name) &&
				!shadowed.has(value)
			) {
				node.shorthand = false;
				node.key = { type: 'Identifier', name: value.name };
			}
			ctx.next();
		},
		Identifier(node, ctx) {
			const replacement = renames.get(node.name);
			const parent = ctx.path[ctx.path.length - 1];
			if (replacement !== undefined && !shadowed.has(node) && isReference(node, parent)) {
				node.name = replacement;
				changed = true;
			}
			ctx.next();
		}
	});
	return changed;
}

export function replaceReferences(
	roots: Root[],
	names: string[],
	build: () => AstTypes.Expression
): boolean {
	const replaced = new Set(names);
	if (replaced.size === 0) return false;
	const shadowed = findShadowedIdentifiers(roots, names);
	let changed = false;

	walkRoots(roots, {
		Property(node, ctx) {
			const value = node.value.type === 'AssignmentPattern' ? node.value.left : node.value;
			if (
				node.shorthand &&
				value.type === 'Identifier' &&
				replaced.has(value.name) &&
				!shadowed.has(value)
			) {
				node.shorthand = false;
				node.key = { type: 'Identifier', name: value.name };
			}
			ctx.next();
		},
		Identifier(node, ctx) {
			const parent = ctx.path[ctx.path.length - 1];
			if (
				replaced.has(node.name) &&
				!shadowed.has(node) &&
				!isBindingIdentifier(node, ctx.path) &&
				!isImportIdentifier(node, parent) &&
				parent.type !== 'ExportSpecifier' &&
				isReference(node, parent)
			) {
				replaceChild(parent, node, build());
				changed = true;
				return;
			}
			ctx.next();
		}
	});
	return changed;
}

export function freeName(roots: Root[], base: string): string {
	const used = new Set<string>();
	walkRoots(roots, {
		Identifier(node, ctx) {
			if (isReference(node, ctx.path.at(-1))) used.add(node.name);
			ctx.next();
		}
	});
	return uniqueName(base, used);
}

function isBindingIdentifier(node: AstTypes.Identifier, path: AstTypes.Node[]): boolean {
	let child: AstTypes.Node = node;
	for (let i = path.length - 1; i >= 0; i -= 1) {
		const parent = path[i];
		if (parent.type === 'VariableDeclarator') return parent.id === child;
		if (
			parent.type === 'FunctionDeclaration' ||
			parent.type === 'FunctionExpression' ||
			parent.type === 'ArrowFunctionExpression'
		) {
			return (
				('id' in parent && parent.id === child) || parent.params.includes(child as AstTypes.Pattern)
			);
		}
		if (parent.type === 'ClassDeclaration' || parent.type === 'ClassExpression') {
			return parent.id === child;
		}
		if (parent.type === 'CatchClause') return parent.param === child;
		if (
			parent.type !== 'ObjectPattern' &&
			parent.type !== 'ArrayPattern' &&
			parent.type !== 'AssignmentPattern' &&
			parent.type !== 'RestElement' &&
			parent.type !== 'Property'
		) {
			return false;
		}
		child = parent;
	}
	return false;
}

function walkRoots(
	roots: Root[],
	visitors: Parameters<typeof Walker.walk<AstTypes.Node, null>>[2]
): void {
	for (const root of roots) Walker.walk(root as AstTypes.Node, null, visitors);
}

function isImportIdentifier(node: AstTypes.Identifier, parent: AstTypes.Node): boolean {
	return (
		(parent.type === 'ImportSpecifier' ||
			parent.type === 'ImportDefaultSpecifier' ||
			parent.type === 'ImportNamespaceSpecifier') &&
		parent.local === node
	);
}
