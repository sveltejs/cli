/** @typedef {import("../index.ts").AstTypes} AstTypes */
/** @typedef {import("../index.ts").AstTypes.ExportDefaultDeclaration} ExportDefaultDeclaration */
/** @typedef {import("../index.ts").AstTypes.Expression} Expression */
/** @typedef {import("../index.ts").AstTypes.Program} Program */
/** @typedef {import("../index.ts").AstTypes.VariableDeclaration} VariableDeclaration */
/** @typedef {import("../index.ts").AstTypes.VariableDeclarator} VariableDeclarator */
/** @typedef {import("../index.ts").AstTypes.Identifier} Identifier */
/** @typedef {import("../index.ts").AstTypes.ExportNamedDeclaration} ExportNamedDeclaration */

/**
 * @template T
 * @typedef {{
 *   astNode: ExportDefaultDeclaration,
 *   value: T,
 *   isFallback: boolean
 * }} ExportDefaultResult
 */

/**
 * @template {Expression} T
 * @param {Program} node
 * @param {{ fallback: T }} options
 * @returns {ExportDefaultResult<T>}
 */
export function createDefault(node, options) {
	const existingNode = node.body.find((item) => item.type === 'ExportDefaultDeclaration');
	if (!existingNode) {
		/** @type {ExportDefaultDeclaration} */
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

		/** @type {VariableDeclaration | undefined} */
		let variableDeclaration = undefined;
		/** @type {VariableDeclarator | undefined} */
		let variableDeclarator = undefined;
		for (const declaration of node.body) {
			if (declaration.type !== 'VariableDeclaration') continue;

			const declarator = declaration.declarations.find(
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
 * @param {Program} node
 * @param {{ name: string; fallback: VariableDeclaration }} options
 * @returns {ExportNamedDeclaration}
 */
export function createNamed(node, options) {
	const namedExports = node.body.filter((item) => item.type === 'ExportNamedDeclaration');
	let namedExport = namedExports.find((exportNode) => {
		const variableDeclaration = /** @type {VariableDeclaration} */ (exportNode.declaration);
		const variableDeclarator = /** @type {VariableDeclarator} */ (
			variableDeclaration.declarations[0]
		);
		const identifier = /** @type {Identifier} */ (variableDeclarator.id);
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
