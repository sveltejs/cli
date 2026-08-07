import * as Walker from 'zimmerframe';
import type { AstTypes } from '../index.ts';
import { areNodesEqual } from './common.ts';

export function addEmpty(node: AstTypes.Program, options: { from: string }): void {
	const expectedImportDeclaration: AstTypes.ImportDeclaration = {
		type: 'ImportDeclaration',
		source: {
			type: 'Literal',
			value: options.from
		},
		specifiers: [],
		attributes: [],
		importKind: 'value'
	};

	addImportIfNecessary(node, expectedImportDeclaration);
}

export function addNamespace(node: AstTypes.Program, options: { from: string; as: string }): void {
	const expectedImportDeclaration: AstTypes.ImportDeclaration = {
		type: 'ImportDeclaration',
		importKind: 'value',
		source: { type: 'Literal', value: options.from },
		specifiers: [
			{
				type: 'ImportNamespaceSpecifier',
				local: { type: 'Identifier', name: options.as }
			}
		],
		attributes: []
	};

	addImportIfNecessary(node, expectedImportDeclaration);
}

export function addDefault(node: AstTypes.Program, options: { from: string; as: string }): void {
	const expectedImportDeclaration: AstTypes.ImportDeclaration = {
		type: 'ImportDeclaration',
		source: {
			type: 'Literal',
			value: options.from
		},
		specifiers: [
			{
				type: 'ImportDefaultSpecifier',
				local: {
					type: 'Identifier',
					name: options.as
				}
			}
		],
		attributes: [],
		importKind: 'value'
	};

	addImportIfNecessary(node, expectedImportDeclaration);
}

export function addNamed(
	node: AstTypes.Program,
	options: {
		/**
		 * ```ts
		 * imports: { 'name': 'alias' } | ['name']
		 * ```
		 */
		imports: Record<string, string> | string[];
		from: string;
		isType?: boolean;
	}
): void {
	const o_imports = Array.isArray(options.imports)
		? Object.fromEntries(options.imports.map((n) => [n, n]))
		: options.imports;

	const specifiers = Object.entries(o_imports).map(([key, value]) => {
		const specifier: AstTypes.ImportSpecifier = {
			type: 'ImportSpecifier',
			imported: {
				type: 'Identifier',
				name: key
			},
			local: {
				type: 'Identifier',
				name: value
			}
		};
		return specifier;
	});

	const expectedImportKind = options.isType ? 'type' : 'value';
	let importDecl: AstTypes.ImportDeclaration | undefined;

	Walker.walk(node as AstTypes.Node, null, {
		ImportDeclaration(declaration) {
			if (
				declaration.source.value === options.from &&
				declaration.specifiers &&
				declaration.importKind === expectedImportKind
			) {
				importDecl = declaration;
			}
		}
	});

	// merge the specifiers into a single import declaration if they share a source
	if (importDecl) {
		const declaration = importDecl;
		specifiers.forEach((specifierToAdd) => {
			// skip specifiers whose imported or local name is already taken
			const conflicts = declaration.specifiers.some(
				(existingSpecifier) =>
					existingSpecifier.local?.name === specifierToAdd.local.name ||
					(existingSpecifier.type === 'ImportSpecifier' &&
						existingSpecifier.imported.type === 'Identifier' &&
						specifierToAdd.imported.type === 'Identifier' &&
						existingSpecifier.imported.name === specifierToAdd.imported.name)
			);
			if (!conflicts) {
				declaration.specifiers.push(specifierToAdd);
			}
		});
		return;
	}

	const expectedImportDeclaration: AstTypes.ImportDeclaration = {
		type: 'ImportDeclaration',
		source: {
			type: 'Literal',
			value: options.from
		},
		specifiers,
		attributes: [],
		importKind: expectedImportKind
	};

	node.body.unshift(expectedImportDeclaration);
}

function addImportIfNecessary(
	node: AstTypes.Program,
	expectedImportDeclaration: AstTypes.ImportDeclaration
) {
	const importDeclarations = node.body.filter((item) => item.type === 'ImportDeclaration');
	const importDeclaration = importDeclarations.find((item) =>
		areNodesEqual(item, expectedImportDeclaration)
	);

	if (!importDeclaration) {
		node.body.unshift(expectedImportDeclaration);
	}
}

type FoundImportBase = { source: string; sourceNode: AstTypes.Literal; path: AstTypes.Node[] };
export type FoundImport =
	| ({ kind: 'static'; node: AstTypes.ImportDeclaration } & FoundImportBase)
	| ({ kind: 'dynamic'; node: AstTypes.ImportExpression } & FoundImportBase);

/**
 * Find every import of a module - both static `import ... from '...'` declarations and dynamic
 * `import('...')` expressions, anywhere in the tree. Optionally filtered by source (exact string
 * or `RegExp`). Dynamic imports whose source is not a string literal are skipped. Each match
 * exposes the source `Literal` (`sourceNode`) for rewriting and its ancestor `path` so callers
 * can inspect the surrounding code (e.g. destructuring).
 */
export function findAll(
	ast: AstTypes.Node,
	options: { from?: string | RegExp } = {}
): FoundImport[] {
	const matches: FoundImport[] = [];

	const matchesSource = (source: string): boolean => {
		if (options.from === undefined) return true;
		if (typeof options.from === 'string') return source === options.from;
		return options.from.test(source);
	};

	Walker.walk(ast, null, {
		ImportDeclaration(node, { path, next }) {
			const sourceNode = node.source;
			if (typeof sourceNode.value === 'string' && matchesSource(sourceNode.value)) {
				matches.push({
					kind: 'static',
					node,
					source: sourceNode.value,
					sourceNode,
					path: [...path]
				});
			}
			next();
		},
		ImportExpression(node, { path, next }) {
			const sourceNode = node.source;
			if (
				sourceNode.type === 'Literal' &&
				typeof sourceNode.value === 'string' &&
				matchesSource(sourceNode.value)
			) {
				matches.push({
					kind: 'dynamic',
					node,
					source: sourceNode.value,
					sourceNode,
					path: [...path]
				});
			}
			next();
		}
	});

	return matches;
}

export function find(
	ast: AstTypes.Program,
	options: { name: string; from: string }
):
	| { statement: AstTypes.ImportDeclaration; alias: string }
	| { statement: undefined; alias: undefined } {
	let alias = options.name;
	let statement: AstTypes.ImportDeclaration;

	Walker.walk(ast as AstTypes.Node, null, {
		ImportDeclaration(node, { stop }) {
			if (node.specifiers && node.source.value === options.from) {
				const specifier = node.specifiers.find(
					(sp) =>
						sp.type === 'ImportSpecifier' &&
						sp.imported.type === 'Identifier' &&
						sp.imported.name === options.name
				) as AstTypes.ImportSpecifier | undefined;
				if (specifier) {
					statement = node;
					alias = (specifier.local?.name ?? alias) as string;
					stop();
					return;
				}
			}
		}
	});

	if (statement!) {
		return { statement, alias };
	}

	return { statement: undefined, alias: undefined };
}

/**
 * Remove every named specifier importing `name` from `from` - across all declarations of that
 * source (including aliased and repeated imports). Declarations left without specifiers are
 * deleted; side-effect imports (`import 'x'`) never match and are left untouched.
 */
export function remove(
	ast: AstTypes.Program,
	options: {
		name: string;
		from: string;
		statement?: AstTypes.ImportDeclaration; // Just in case you want to pass the statement directly
	}
): void {
	const statements = options.statement
		? [options.statement]
		: ast.body.filter(
				(node): node is AstTypes.ImportDeclaration =>
					node.type === 'ImportDeclaration' && node.source.value === options.from
			);

	for (const statement of statements) {
		const remaining = statement.specifiers.filter(
			(s) =>
				s.type !== 'ImportSpecifier' ||
				s.imported.type !== 'Identifier' ||
				s.imported.name !== options.name
		);
		if (remaining.length === statement.specifiers.length) continue;

		if (remaining.length === 0) {
			const idxToRemove = ast.body.indexOf(statement);
			if (idxToRemove !== -1) ast.body.splice(idxToRemove, 1);
		} else {
			statement.specifiers = remaining;
		}
	}
}
