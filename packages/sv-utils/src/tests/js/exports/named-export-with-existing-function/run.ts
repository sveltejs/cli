import type { AstTypes } from '../../../../tooling/index.ts';
import { variables, object, exports } from '../../../../tooling/js/index.ts';

export function run(ast: AstTypes.Program): void {
	const variableFallback = variables.declaration(ast, {
		kind: 'const',
		name: 'variable',
		value: object.create({})
	});

	exports.createNamed(ast, {
		name: 'named',
		fallback: variableFallback
	});
}
