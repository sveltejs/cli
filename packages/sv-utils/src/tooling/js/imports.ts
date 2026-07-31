import * as Walker from 'zimmerframe';
import type { AstTypes, SvelteAst } from '../index.ts';
import { areNodesEqual } from './common.ts';
import * as identifiers from './identifiers.ts';

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
	const matchingDeclarations: AstTypes.ImportDeclaration[] = [];

	Walker.walk(node as AstTypes.Node, null, {
		ImportDeclaration(declaration) {
			if (declaration.source.value === options.from) {
				matchingDeclarations.push(declaration);
			}
		}
	});

	const valueDeclaration = matchingDeclarations.find(
		(declaration) =>
			declaration.importKind === 'value' &&
			!declaration.specifiers.some((specifier) => specifier.type === 'ImportNamespaceSpecifier')
	);
	const typeDeclaration = matchingDeclarations.find(
		(declaration) =>
			declaration.importKind === 'type' &&
			declaration.specifiers.every((specifier) => specifier.type === 'ImportSpecifier')
	);
	const importDecl = valueDeclaration ?? typeDeclaration;

	// merge the specifiers into a single import declaration if they share a source
	if (importDecl) {
		const declaration = importDecl;
		if (!options.isType && declaration.importKind === 'type') {
			declaration.importKind = 'value';
			for (const specifier of declaration.specifiers) {
				if (specifier.type === 'ImportSpecifier') specifier.importKind = 'type';
			}
		}
		if (options.isType && declaration.importKind === 'value') {
			for (const specifier of specifiers) specifier.importKind = 'type';
		}
		specifiers.forEach((specifierToAdd) => {
			// skip specifiers whose imported or local name is already taken
			const conflicts = matchingDeclarations.some((matchingDeclaration) =>
				matchingDeclaration.specifiers.some(
					(existingSpecifier) =>
						existingSpecifier.local?.name === specifierToAdd.local.name ||
						(existingSpecifier.type === 'ImportSpecifier' &&
							existingSpecifier.imported.type === 'Identifier' &&
							specifierToAdd.imported.type === 'Identifier' &&
							existingSpecifier.imported.name === specifierToAdd.imported.name)
				)
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

export function setSource(found: FoundImport, source: string): void {
	found.source = source;
	found.sourceNode.value = source;
	found.sourceNode.raw = undefined;
}

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
		options.from.lastIndex = 0;
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

export type ImportBinding = {
	kind: 'named' | 'default' | 'namespace';
	imported: string;
	local: string;
	isType: boolean;
	specifier: AstTypes.ImportDeclaration['specifiers'][number];
	declaration: AstTypes.ImportDeclaration;
};

export function bindings(
	ast: AstTypes.Program,
	options: { from: string; name?: string }
): ImportBinding[] {
	const found: ImportBinding[] = [];

	for (const statement of ast.body) {
		if (statement.type !== 'ImportDeclaration' || statement.source.value !== options.from) continue;

		for (const specifier of statement.specifiers) {
			const kind =
				specifier.type === 'ImportSpecifier'
					? 'named'
					: specifier.type === 'ImportDefaultSpecifier'
						? 'default'
						: 'namespace';
			const imported =
				specifier.type === 'ImportSpecifier'
					? specifier.imported.type === 'Identifier'
						? specifier.imported.name
						: String(specifier.imported.value)
					: kind === 'default'
						? 'default'
						: '*';
			if (options.name !== undefined && imported !== options.name) continue;

			found.push({
				kind,
				imported,
				local: specifier.local.name,
				isType:
					statement.importKind === 'type' ||
					(specifier as AstTypes.ImportSpecifier & { importKind?: 'type' | 'value' }).importKind ===
						'type',
				specifier,
				declaration: statement
			});
		}
	}

	return found;
}

export function renameSource(
	ast: AstTypes.Node,
	options: { from: string | RegExp; to: string }
): boolean {
	const found = findAll(ast, { from: options.from });
	for (const item of found) setSource(item, options.to);
	return found.length > 0;
}

export function renameBinding(
	roots: Array<AstTypes.Program | SvelteAst.Fragment>,
	options: { from: string; name: string; to: string; local?: string }
): boolean {
	const renames = new Map<string, string>();
	const programs = roots.filter((root): root is AstTypes.Program => root.type === 'Program');
	const existing = programs.flatMap((program) =>
		bindings(program, { from: options.from, name: options.to })
	);
	const old = programs.flatMap((program) =>
		bindings(program, { from: options.from, name: options.name }).map((binding) => ({
			binding,
			program
		}))
	);
	if (old.length === 0) return false;

	for (const isType of [false, true]) {
		const matching = old.filter(({ binding }) => binding.isType === isType);
		if (matching.length === 0) continue;

		const replacement =
			options.name === options.to
				? undefined
				: existing.find((binding) => binding.isType === isType);
		const first = matching[0].binding;
		const local =
			replacement?.local ??
			options.local ??
			(first.local === options.name ? options.to : first.local);

		for (const { binding } of matching) {
			if (binding.local !== local) renames.set(binding.local, local);
		}

		for (const program of new Set(matching.map(({ program }) => program))) {
			renameNamed(program, {
				from: options.from,
				name: options.name,
				to: options.to,
				local,
				isType
			});
		}
	}

	identifiers.renameReferences(roots, renames);
	return true;
}

function renameNamed(
	program: AstTypes.Program,
	options: { from: string; name: string; to: string; local: string; isType: boolean }
): void {
	const add = () =>
		addNamed(program, {
			from: options.from,
			imports: { [options.to]: options.local },
			isType: options.isType
		});

	add();
	remove(program, { from: options.from, name: options.name });
	add();
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
				)
				if (specifier) {
					statement = node;
					alias = (specifier.local?.name ?? alias)
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
				(s.imported.type === 'Identifier'
					? s.imported.name !== options.name
					: s.imported.value !== options.name)
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
