import type { JsAstEditor } from '@svelte-cli/ast-manipulation';

export function run({ ast, imports }: JsAstEditor): void {
	imports.addNamed(ast, 'package', { namedTwo: 'namedTwo' }, false);
}
