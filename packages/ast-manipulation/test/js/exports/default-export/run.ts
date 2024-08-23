import type { JsAstEditor } from '@svelte-cli/ast-manipulation';

export function run({ ast, object, common, exports }: JsAstEditor): void {
	const object1 = object.create({
		test: common.createLiteral('string')
	});
	const object2 = object.create({
		test2: common.createLiteral('string2')
	});

	exports.defaultExport(ast, object1);

	// overwriting default export should work
	exports.defaultExport(ast, object2);
}
