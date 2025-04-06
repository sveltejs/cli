import { Walker, type AstTypes } from '@sveltejs/ast-tooling';
import { areNodesEqual } from './common.ts';

export function addEmpty(ast: AstTypes.Program, importFrom: string): void {
	const expectedImportDeclaration: AstTypes.ImportDeclaration = {
		type: 'ImportDeclaration',
		source: {
			type: 'Literal',
			value: importFrom
		},
		specifiers: [],
		attributes: [],
		importKind: 'value'
	};

	addImportIfNecessary(ast, expectedImportDeclaration);
}

export function addNamespace(ast: AstTypes.Program, importFrom: string, importAs: string): void {
	const expectedImportDeclaration: AstTypes.ImportDeclaration = {
		type: 'ImportDeclaration',
		importKind: 'value',
		source: { type: 'Literal', value: importFrom },
		specifiers: [
			{
				type: 'ImportNamespaceSpecifier',
				local: { type: 'Identifier', name: importAs }
			}
		],
		attributes: []
	};

	addImportIfNecessary(ast, expectedImportDeclaration);
}

export function addDefault(ast: AstTypes.Program, importFrom: string, importAs: string): void {
	const expectedImportDeclaration: AstTypes.ImportDeclaration = {
		type: 'ImportDeclaration',
		source: {
			type: 'Literal',
			value: importFrom
		},
		specifiers: [
			{
				type: 'ImportDefaultSpecifier',
				local: {
					type: 'Identifier',
					name: importAs
				}
			}
		],
		attributes: [],
		importKind: 'value'
	};

	addImportIfNecessary(ast, expectedImportDeclaration);
}

export function addNamed(
	ast: AstTypes.Program,
	importFrom: string,
	exportedAsImportAs: Record<string, string>,
	isType = false
): void {
	const specifiers = Object.entries(exportedAsImportAs).map(([key, value]) => {
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

	Walker.walk(ast as AstTypes.Node, null, {
		ImportDeclaration(node) {
			if (node.source.value === importFrom && node.specifiers) {
				importDecl = node;
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
			value: importFrom
		},
		specifiers,
		attributes: [],
		importKind: isType ? 'type' : 'value'
	};

	ast.body.unshift(expectedImportDeclaration);
}

function addImportIfNecessary(
	ast: AstTypes.Program,
	expectedImportDeclaration: AstTypes.ImportDeclaration
) {
	const importDeclarations = ast.body.filter((x) => x.type === 'ImportDeclaration');
	const importDeclaration = importDeclarations.find((x) =>
		areNodesEqual(x, expectedImportDeclaration)
	);

	if (!importDeclaration) {
		ast.body.unshift(expectedImportDeclaration);
	}
}
