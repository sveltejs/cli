import type { AstTypes } from '../../../../tooling/index.ts';
import { object, exports } from '../../../../tooling/js/index.ts';

export function run(ast: AstTypes.Program): void {
	const object1 = object.create({
		test: 'string'
	});

	exports.createDefault(ast, {
		fallback: object1
	});
}
