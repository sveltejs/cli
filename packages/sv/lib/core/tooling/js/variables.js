/** @import { AstTypes } from '../index.js' */

/**
 * @param {AstTypes.Program | AstTypes.Declaration} node
 * @param {{ kind: 'const' | 'let' | 'var'; name: string; value: AstTypes.Expression }} options
 * @returns {AstTypes.VariableDeclaration}
 */
export function declaration(node, options) {
	const declarations =
		node.type === 'Program'
			? node.body.filter(
					/** @returns {x is AstTypes.VariableDeclaration} */
					(x) => x.type === 'VariableDeclaration'
				)
			: [/** @type {AstTypes.VariableDeclaration} */ (node)];
	let decl = declarations.find((x) => {
		const declarator = /** @type {AstTypes.VariableDeclarator} */ (x.declarations[0]);
		const identifier = /** @type {AstTypes.Identifier} */ (declarator.id);
		return identifier.name === options.name;
	});

	if (decl) return decl;

	decl = {
		type: 'VariableDeclaration',
		kind: options.kind,
		declarations: [
			{
				type: 'VariableDeclarator',
				id: {
					type: 'Identifier',
					name: options.name
				},
				init: options.value
			}
		]
	};

	return decl;
}

/**
 * @param {string} name
 * @returns {AstTypes.Identifier}
 */
export function createIdentifier(name) {
	/** @type {AstTypes.Identifier} */
	const identifier = {
		type: 'Identifier',
		name
	};
	return identifier;
}

/**
 * @param {AstTypes.VariableDeclarator} node
 * @param {{ typeName: string }} options
 * @returns {AstTypes.VariableDeclarator}
 */
export function typeAnnotateDeclarator(node, options) {
	if (node.id.type === 'Identifier') {
		node.id.typeAnnotation = {
			type: 'TSTypeAnnotation',
			typeAnnotation: {
				type: 'TSTypeReference',
				typeName: {
					type: 'Identifier',
					name: options.typeName
				}
			}
		};
	}

	return node;
}
