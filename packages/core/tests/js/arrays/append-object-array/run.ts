import { array, object, common, variables, type AstTypes } from '@sveltejs/cli-core/js';

export function run(ast: AstTypes.Program): void {
	const array1 = array.create();
	const object1 = object.create({ test: common.parseExpression('true') });
	const object2 = object.create({ test2: common.createLiteral('string') });
	array.append(array1, object1);
	array.append(array1, object2);
	array.append(array1, object2); // avoid duplication

	// create declaration so that we serialize everything
	const declaration = variables.declaration(ast, { kind: 'const', name: 'array', value: array1 });
	ast.body.push(declaration);
}
