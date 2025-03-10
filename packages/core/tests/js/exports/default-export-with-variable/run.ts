import { object, common, variables, exports, type AstTypes } from '@sveltejs/cli-core/js';

export function run(ast: AstTypes.Program): void {
	const object1 = object.create({
		test: common.createLiteral('string')
	});
	const variable = variables.declaration(ast, 'const', 'object', object1);
	ast.body.push(variable);

	exports.defaultExport(ast, variables.identifier('object'));
}
