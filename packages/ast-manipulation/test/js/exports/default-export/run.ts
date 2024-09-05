import type { JsAstEditor } from '@svelte-cli/ast-manipulation';

export function run({ ast, object, common, exports }: JsAstEditor): void {
	const object1 = object.create({
		test: common.createLiteral('string')
	});

	exports.defaultExport(ast, object1);
}
