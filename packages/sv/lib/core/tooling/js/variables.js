/** @typedef {import("../index.ts").AstTypes} AstTypes */
/** @typedef {import("../index.ts").AstTypes.Program} Program */
/** @typedef {import("../index.ts").AstTypes.Declaration} Declaration */
/** @typedef {import("../index.ts").AstTypes.VariableDeclaration} VariableDeclaration */
/** @typedef {import("../index.ts").AstTypes.VariableDeclarator} VariableDeclarator */
/** @typedef {import("../index.ts").AstTypes.Expression} Expression */
/** @typedef {import("../index.ts").AstTypes.Identifier} Identifier */
/** @typedef {import("../index.ts").AstTypes.TSTypeAnnotation} TSTypeAnnotation */
/** @typedef {import("../index.ts").AstTypes.TSTypeReference} TSTypeReference */

/**
 * @param {Program | Declaration} node
 * @param {{ kind: 'const' | 'let' | 'var'; name: string; value: Expression }} options
 * @returns {VariableDeclaration}
 */
export function declaration(node, options) {
	const declarations =
		node.type === 'Program'
			? node.body.filter((x) => x.type === 'VariableDeclaration')
			: [/** @type {VariableDeclaration} */ (node)];
	let declaration = declarations.find((x) => {
		const declarator = /** @type {VariableDeclarator} */ (x.declarations[0]);
		const identifier = /** @type {Identifier} */ (declarator.id);
		return identifier.name === options.name;
	});

	if (declaration) return declaration;

	/** @type {VariableDeclaration} */
	declaration = {
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

	return declaration;
}

/**
 * @param {string} name
 * @returns {Identifier}
 */
export function createIdentifier(name) {
	/** @type {Identifier} */
	const identifier = {
		type: 'Identifier',
		name
	};
	return identifier;
}

/**
 * @param {VariableDeclarator} node
 * @param {{ typeName: string }} options
 * @returns {VariableDeclarator}
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
