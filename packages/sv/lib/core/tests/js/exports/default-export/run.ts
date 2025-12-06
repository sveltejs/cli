import { object, exports, type AstTypes } from '@sveltejs/cli-core/js';

export function run(ast: AstTypes.Program): void {
	const object1 = object.create({
		test: 'string'
	});

	exports.createDefault(ast, {
		fallback: object1
	});
}
