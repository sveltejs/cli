import { variables, common, object } from '@svelte-cli/core/js';
import type { ScriptFileEditor } from '@svelte-cli/core';

export function run({ ast }: ScriptFileEditor<any>): void {
	const testNumberVariable = variables.declaration(
		ast,
		'const',
		'testNumber',
		common.createLiteral(2)
	);
	ast.body.push(testNumberVariable);

	const objectExpression = object.create({
		foo: common.createLiteral('bar')
	});
	const testObjectVariable = variables.declaration(ast, 'const', 'testObject', objectExpression);
	ast.body.push(testObjectVariable);
}
