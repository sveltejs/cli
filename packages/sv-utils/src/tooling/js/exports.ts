import type { AstTypes } from '../index.ts';
import { areNodesEqual } from './common.ts';
import * as variables from './variables.ts';

export type ExportDefaultResult<T> = {
	astNode: AstTypes.ExportDefaultDeclaration;
	value: T;
	isFallback: boolean;
};

export function createDefault<T extends AstTypes.Expression>(
	node: AstTypes.Program,
	options: { fallback: T }
): ExportDefaultResult<T> {
	const existingNode = node.body.find((item) => item.type === 'ExportDefaultDeclaration');
	if (!existingNode) {
		const exportNode: AstTypes.ExportDefaultDeclaration = {
			type: 'ExportDefaultDeclaration',
			declaration: options.fallback
		};

		node.body.push(exportNode);
		return { astNode: exportNode, value: options.fallback, isFallback: true };
	}

	const exportDefaultDeclaration = existingNode;

	if (exportDefaultDeclaration.declaration.type === 'Identifier') {
		// in this case the export default declaration is only referencing a variable, get that variable
		const identifier = exportDefaultDeclaration.declaration;
		const variableDeclaration = variables.declaration(node, {
			kind: 'const',
			name: identifier.name,
			value: { type: 'Literal', value: null }
		});

		if (!node.body.includes(variableDeclaration))
			throw new Error(`Unable to find exported variable '${identifier.name}'`);

		const variableDeclarator = variableDeclaration.declarations[0] as AstTypes.VariableDeclarator;
		const value = variableDeclarator.init as T;

		return { astNode: exportDefaultDeclaration, value, isFallback: false };
	}

	const declaration = exportDefaultDeclaration.declaration as T;
	return { astNode: exportDefaultDeclaration, value: declaration, isFallback: false };
}

export function createNamed(
	node: AstTypes.Program,
	options: { name: string; fallback: AstTypes.VariableDeclaration }
): AstTypes.ExportNamedDeclaration {
	const namedExports = node.body.filter((item) => item.type === 'ExportNamedDeclaration');
	let namedExport = namedExports.find((exportNode) => {
		if (!exportNode.declaration) return false;
		const variableDeclaration = exportNode.declaration as AstTypes.VariableDeclaration;
		const variableDeclarator = variableDeclaration.declarations[0] as AstTypes.VariableDeclarator;
		const identifier = variableDeclarator.id as AstTypes.Identifier;
		return identifier.name === options.name;
	});

	if (namedExport) return namedExport;

	namedExport = {
		type: 'ExportNamedDeclaration',
		declaration: options.fallback,
		specifiers: [],
		attributes: []
	};
	node.body.push(namedExport);
	return namedExport;
}

export function addNamespace(node: AstTypes.Program, options: { from: string; as?: string }): void {
	const expectedExportAllDeclaration: AstTypes.ExportAllDeclaration = {
		type: 'ExportAllDeclaration',
		source: {
			type: 'Literal',
			value: options.from
		},
		exported: options.as ? { type: 'Identifier', name: options.as } : null,
		attributes: []
	};

	const exportAllDeclarations = node.body.filter((item) => item.type === 'ExportAllDeclaration');
	const existingExport = exportAllDeclarations.find((item) =>
		areNodesEqual(item, expectedExportAllDeclaration)
	);

	if (!existingExport) {
		node.body.push(expectedExportAllDeclaration);
	}
}
