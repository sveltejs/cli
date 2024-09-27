import { imports } from '@svelte-cli/core/js';
import type { ScriptFileEditor } from '@svelte-cli/core';

export function run({ ast }: ScriptFileEditor<any>): void {
	imports.addEmpty(ast, './relativ/file.css');

	// allow importing from npm packages
	imports.addEmpty(ast, 'package/file.css');
}
