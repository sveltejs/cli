import type { JsAstEditor } from '@svelte-cli/ast-manipulation';

export function run({ ast, imports }: JsAstEditor): void {
	imports.addEmpty(ast, 'package/file.js');
	imports.addDefault(ast, 'package', 'MyPackage');
	imports.addNamed(ast, 'package2', { Named: 'Named' });
}
