import { object, variables, exports, type AstTypes } from '../../../../tooling/js/index.js';

export function run(ast: AstTypes.Program): void {
	const object1 = object.create({
		test: 'string'
	});
	const variable = variables.declaration(ast, {
		kind: 'const',
		name: 'object',
		value: object1
	});
	ast.body.push(variable);

	exports.createDefault(ast, {
		fallback: variables.createIdentifier('object')
	});
}
