import type { AstTypes } from '../../../../tooling/index.ts';
import { identifiers } from '../../../../tooling/js/index.ts';

export function run(ast: AstTypes.Program): void {
	const used = new Set(['name', 'name2']);
	const unique = identifiers.uniqueName('name', used);
	const free = identifiers.freeName([ast], 'name');
	const declaration = ast.body[1] as AstTypes.VariableDeclaration;
	const member = declaration.declarations[0]!.init as AstTypes.MemberExpression;
	if (unique !== 'name3' || !used.has(unique)) throw new Error('Unexpected unique name');
	if (free !== 'name4') throw new Error('Unexpected free name');
	if (identifiers.isReference(member.property, member)) throw new Error('Property is a reference');
}
