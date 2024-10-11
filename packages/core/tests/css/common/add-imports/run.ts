import { addImports } from '@sveltejs/cli-core/css';
import type { CssFileEditor } from '@sveltejs/cli-core';

export function run({ ast }: CssFileEditor<any>): void {
	addImports(ast, ["'lib/path/file.css'"]);
}
