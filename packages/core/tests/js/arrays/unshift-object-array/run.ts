import { array, object, common, variables, type AstTypes } from '@sveltejs/cli-core/js';

export function run(ast: AstTypes.Program): void {
	const array1 = array.createEmpty();

	const object1 = object.create({ test: common.expressionFromString('true') });
	const object2 = object.create({ test2: common.createLiteral('string') });
	array.unshift(array1, object1);
	array.unshift(array1, object2);
	array.unshift(array1, object2); // avoid duplication

	// create declaration so that we serialize everything
	const declaration = variables.declaration(ast, 'const', 'array', array1);
	ast.body.push(declaration);
}
