import { object, exports, type AstTypes } from '../../../../tooling/js/index.js';

export function run(ast: AstTypes.Program): void {
	const object1 = object.create({
		test: 'string'
	});

	exports.createDefault(ast, {
		fallback: object1
	});
}
