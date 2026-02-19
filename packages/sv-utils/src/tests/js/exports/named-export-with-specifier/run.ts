import { variables, object, exports, type AstTypes } from '../../../../tooling/js/index.ts';

export function run(ast: AstTypes.Program): void {
	const fallback = variables.declaration(ast, {
		kind: 'const',
		name: 'other',
		value: object.create({ test: 'string' })
	});

	exports.createNamed(ast, { name: 'other', fallback });
}
