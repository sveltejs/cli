import { variables, object, exports, type AstTypes } from '@sveltejs/cli-core/js';

export function run(ast: AstTypes.Program): void {
	const object1 = object.create({
		test: 'string'
	});
	const variable = variables.declaration(ast, {
		kind: 'const',
		name: 'variable',
		value: object1
	});

	const object2 = object.create({
		test2: 'string2'
	});
	const variable2 = variables.declaration(ast, {
		kind: 'const',
		name: 'variable2',
		value: object2
	});

	exports.createNamed(ast, { name: 'variable', fallback: variable });
	exports.createNamed(ast, { name: 'variable2', fallback: variable2 });

	// overriding should work
	exports.createNamed(ast, { name: 'variable', fallback: variable });
	exports.createNamed(ast, { name: 'variable2', fallback: variable2 });
}
