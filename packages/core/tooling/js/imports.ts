import { Walker, type AstTypes } from '../index.ts';
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

	let importDecl: AstTypes.ImportDeclaration | undefined;

	Walker.walk(node as AstTypes.Node, null, {
		ImportDeclaration(declaration) {
			if (declaration.source.value === options.from && declaration.specifiers) {
				importDecl = declaration;
			}
		}
	});

	// merge the specifiers into a single import declaration if they share a source
	if (importDecl) {
		specifiers.forEach((specifierToAdd) => {
			const sourceExists = importDecl?.specifiers?.every(
				(existingSpecifier) =>
					existingSpecifier.type === 'ImportSpecifier' &&
					existingSpecifier.local?.name !== specifierToAdd.local?.name &&
					existingSpecifier.imported.type === 'Identifier' &&
					specifierToAdd.imported.type === 'Identifier' &&
					existingSpecifier.imported.name !== specifierToAdd.imported.name
			);
			if (sourceExists) {
				importDecl?.specifiers?.push(specifierToAdd);
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
		importKind: options.isType ? 'type' : 'value'
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

export function find(
	ast: AstTypes.Program,
	options: { name: string }
):
	| { statement: AstTypes.ImportDeclaration; alias: string }
	| { statement: undefined; alias: undefined } {
	let alias = options.name;
	let statement: AstTypes.ImportDeclaration;

	Walker.walk(ast as AstTypes.Node, null, {
		ImportDeclaration(node) {
			if (node.specifiers) {
				const specifier = node.specifiers.find(
					(sp) =>
						sp.type === 'ImportSpecifier' &&
						sp.imported.type === 'Identifier' &&
						sp.imported.name === options.name
				) as AstTypes.ImportSpecifier | undefined;
				if (specifier) {
					statement = node;
					alias = (specifier.local?.name ?? alias) as string;
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
