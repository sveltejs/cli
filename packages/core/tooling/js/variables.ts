import type { AstTypes } from '../utils.ts';

export function declaration(
	ast: AstTypes.Program | AstTypes.Declaration,
	kind: 'const' | 'let' | 'var',
	name: string,
	value: AstTypes.Expression
): AstTypes.VariableDeclaration {
	const declarations =
		ast.type === 'Program'
			? ast.body.filter((x): x is AstTypes.VariableDeclaration => x.type === 'VariableDeclaration')
			: [ast as AstTypes.VariableDeclaration];
	let declaration = declarations.find((x) => {
		const declarator = x.declarations[0] as AstTypes.VariableDeclarator;
		const identifier = declarator.id as AstTypes.Identifier;
		return identifier.name === name;
	});

	if (declaration) return declaration;

	declaration = {
		type: 'VariableDeclaration',
		kind,
		declarations: [
			{
				type: 'VariableDeclarator',
				id: {
					type: 'Identifier',
					name
				},
				init: value
			}
		]
	};

	return declaration;
}

export function identifier(name: string): AstTypes.Identifier {
	const identifier: AstTypes.Identifier = {
		type: 'Identifier',
		name
	};
	return identifier;
}

export function typeAnnotateDeclarator(
	node: AstTypes.VariableDeclarator,
	typeName: string
): AstTypes.VariableDeclarator {
	if (node.id.type === 'Identifier') {
		node.id.typeAnnotation = {
			type: 'TSTypeAnnotation',
			typeAnnotation: {
				type: 'TSTypeReference',
				typeName: {
					type: 'Identifier',
					name: typeName
				}
			}
		};
	}

	return node;
}
