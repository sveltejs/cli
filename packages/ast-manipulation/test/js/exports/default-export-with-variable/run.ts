import type { JsAstEditor } from '@svelte-cli/ast-manipulation';

export function run({ ast, object, common, variables, exports }: JsAstEditor): void {
	const object1 = object.create({
		test: common.createLiteral('string')
	});
	const variable = variables.declaration(ast, 'const', 'object', object1);
	ast.body.push(variable);

	exports.defaultExport(ast, variables.identifier('object'));
}
