import type { AstTypes } from '../index.ts';

export type ExportDefaultResult<T> = {
	astNode: AstTypes.ExportDefaultDeclaration;
	value: T;
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
		return { astNode: exportNode, value: options.fallback };
	}

	const exportDefaultDeclaration = existingNode;

	if (exportDefaultDeclaration.declaration.type === 'Identifier') {
		// in this case the export default declaration is only referencing a variable, get that variable
		const identifier = exportDefaultDeclaration.declaration;

		let variableDeclaration: AstTypes.VariableDeclaration | undefined;
		let variableDeclarator: AstTypes.VariableDeclarator | undefined;
		for (const declaration of node.body) {
			if (declaration.type !== 'VariableDeclaration') continue;

			const declarator = declaration.declarations.find(
				(declarator): declarator is AstTypes.VariableDeclarator =>
					declarator.type === 'VariableDeclarator' &&
					declarator.id.type === 'Identifier' &&
					declarator.id.name === identifier.name
			);

			variableDeclarator = declarator;
			variableDeclaration = declaration;
		}
		if (!variableDeclaration || !variableDeclarator)
			throw new Error(`Unable to find exported variable '${identifier.name}'`);

		const value = variableDeclarator.init as T;

		return { astNode: exportDefaultDeclaration, value };
	}

	const declaration = exportDefaultDeclaration.declaration as T;
	return { astNode: exportDefaultDeclaration, value: declaration };
}

export function createNamed(
	node: AstTypes.Program,
	options: { name: string; fallback: AstTypes.VariableDeclaration }
): AstTypes.ExportNamedDeclaration {
	const namedExports = node.body.filter((item) => item.type === 'ExportNamedDeclaration');
	let namedExport = namedExports.find((exportNode) => {
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
