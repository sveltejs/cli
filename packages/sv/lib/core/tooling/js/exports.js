/** @import { AstTypes } from '../index.js' */

/**
 * @template {AstTypes.Expression} T
 * @typedef {{
 *   astNode: AstTypes.ExportDefaultDeclaration;
 *   value: T;
 *   isFallback: boolean;
 * }} ExportDefaultResult
 */

/**
 * @template {AstTypes.Expression} T
 * @param {AstTypes.Program} node
 * @param {{ fallback: T }} options
 * @returns {ExportDefaultResult<T>}
 */
export function createDefault(node, options) {
	const existingNode = node.body.find((item) => item.type === 'ExportDefaultDeclaration');
	if (!existingNode) {
		/** @type {AstTypes.ExportDefaultDeclaration} */
		const exportNode = {
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

		/** @type {AstTypes.VariableDeclaration | undefined} */
		let variableDeclaration;
		/** @type {AstTypes.VariableDeclarator | undefined} */
		let variableDeclarator;
		for (const declaration of node.body) {
			if (declaration.type !== 'VariableDeclaration') continue;

			const declarator = declaration.declarations.find(
				/** @returns {declarator is AstTypes.VariableDeclarator} */
				(declarator) =>
					declarator.type === 'VariableDeclarator' &&
					declarator.id.type === 'Identifier' &&
					declarator.id.name === identifier.name
			);

			variableDeclarator = declarator;
			variableDeclaration = declaration;
		}
		if (!variableDeclaration || !variableDeclarator)
			throw new Error(`Unable to find exported variable '${identifier.name}'`);

		const value = /** @type {T} */ (variableDeclarator.init);

		return { astNode: exportDefaultDeclaration, value, isFallback: false };
	}

	const declaration = /** @type {T} */ (exportDefaultDeclaration.declaration);
	return { astNode: exportDefaultDeclaration, value: declaration, isFallback: false };
}

/**
 * @param {AstTypes.Program} node
 * @param {{ name: string; fallback: AstTypes.VariableDeclaration }} options
 * @returns {AstTypes.ExportNamedDeclaration}
 */
export function createNamed(node, options) {
	const namedExports = node.body.filter((item) => item.type === 'ExportNamedDeclaration');
	let namedExport = namedExports.find((exportNode) => {
		const variableDeclaration = /** @type {AstTypes.VariableDeclaration} */ (
			exportNode.declaration
		);
		const variableDeclarator = /** @type {AstTypes.VariableDeclarator} */ (
			variableDeclaration.declarations[0]
		);
		const identifier = /** @type {AstTypes.Identifier} */ (variableDeclarator.id);
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
