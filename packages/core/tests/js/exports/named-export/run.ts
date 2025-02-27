import { common, variables, object, exports, type AstTypes } from '@sveltejs/cli-core/js';

export function run(ast: AstTypes.Program): void {
	const object1 = object.create({
		test: common.createLiteral('string')
	});
	const variable = variables.declaration(ast, 'const', 'variable', object1);

	const object2 = object.create({
		test2: common.createLiteral('string2')
	});
	const variable2 = variables.declaration(ast, 'const', 'variable2', object2);

	exports.namedExport(ast, 'variable', variable);
	exports.namedExport(ast, 'variable2', variable2);

	// overriding should work
	exports.namedExport(ast, 'variable', variable);
	exports.namedExport(ast, 'variable2', variable2);
}
