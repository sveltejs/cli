import { addImports } from '@svelte-cli/core/css';
import type { CssFileEditor } from '@svelte-cli/core';

export function run({ ast }: CssFileEditor<any>): void {
	addImports(ast, ["'lib/path/file.css'"]);
}
