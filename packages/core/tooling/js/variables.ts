import type { AstTypes } from '../index.ts';

export function declaration(
	node: AstTypes.Program | AstTypes.Declaration,
	options: {
		kind: 'const' | 'let' | 'var';
		name: string;
		value: AstTypes.Expression;
	}
): AstTypes.VariableDeclaration {
	const declarations =
		node.type === 'Program'
			? node.body.filter((x): x is AstTypes.VariableDeclaration => x.type === 'VariableDeclaration')
			: [node as AstTypes.VariableDeclaration];
	let declaration = declarations.find((x) => {
		const declarator = x.declarations[0] as AstTypes.VariableDeclarator;
		const identifier = declarator.id as AstTypes.Identifier;
		return identifier.name === options.name;
	});

	if (declaration) return declaration;

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

export function createIdentifier(name: string): AstTypes.Identifier {
	const identifier: AstTypes.Identifier = {
		type: 'Identifier',
		name
	};
	return identifier;
}

export function typeAnnotateDeclarator(
	node: AstTypes.VariableDeclarator,
	options: {
		typeName: string;
	}
): AstTypes.VariableDeclarator {
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
