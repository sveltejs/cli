import type { AstTypes } from '../../../../tooling/index.ts';
import { imports } from '../../../../tooling/js/index.ts';

// `findAll` matches both static and dynamic imports, filtered by source.
export function run(ast: AstTypes.Program): void {
	for (const found of imports.findAll(ast, { from: /^pkg/ })) {
		found.sourceNode.value = `MIGRATED/${found.kind}/${found.source}`;
		found.sourceNode.raw = undefined;
	}
}
