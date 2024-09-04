import type { CssAstEditor } from '@svelte-cli/ast-manipulation';

export function run({ ast, addImports }: CssAstEditor): void {
	addImports(ast, ["'lib/path/file.css'"]);
}
