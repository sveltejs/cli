import type { AstTypes } from '../../../../tooling/index.ts';
import { common } from '../../../../tooling/js/index.ts';

export function run(ast: AstTypes.Program): void {
	const directDeclaration = ast.body[0] as AstTypes.VariableDeclaration;
	const declarator = directDeclaration.declarations[0];
	const direct = declarator.init!;
	if (!common.replaceChild(declarator, direct, common.parseExpression('3'))) {
		throw new Error('Expected to replace a direct property');
	}

	const arrayDeclaration = ast.body[1];
	if (!common.replaceChild(ast, arrayDeclaration, common.parseStatement('const replaced = 4'))) {
		throw new Error('Expected to replace an array item');
	}

	if (common.replaceChild(ast, direct, common.parseExpression('5'))) {
		throw new Error('Expected nested nodes not to be replaced');
	}
}
