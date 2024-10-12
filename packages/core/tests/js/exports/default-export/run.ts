import { object, common, exports } from '@sveltejs/cli-core/js';
import type { ScriptFileEditor } from '@sveltejs/cli-core';

export function run({ ast }: ScriptFileEditor<any>): void {
	const object1 = object.create({
		test: common.createLiteral('string')
	});

	exports.defaultExport(ast, object1);
}
