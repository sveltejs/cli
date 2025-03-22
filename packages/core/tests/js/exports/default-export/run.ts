import { object, common, exports, type AstTypes } from '@sveltejs/cli-core/js';

export function run(ast: AstTypes.Program): void {
	const object1 = object.create({
		test: common.createLiteral('string')
	});

	exports.defaultExport(ast, object1);
}
