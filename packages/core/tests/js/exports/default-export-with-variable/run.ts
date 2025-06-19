import { object, common, variables, exports, type AstTypes } from '@sveltejs/cli-core/js';

export function run(ast: AstTypes.Program): void {
	const object1 = object.create({
		test: common.createLiteral({
			value: 'string'
		})
	});
	const variable = variables.declaration(ast, {
		kind: 'const',
		name: 'object',
		value: object1
	});
	ast.body.push(variable);

	exports.createDefault(ast, {
		fallback: variables.createIdentifier({
			name: 'object'
		})
	});
}
