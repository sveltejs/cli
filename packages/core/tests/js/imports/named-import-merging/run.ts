import { imports } from '@svelte-cli/core/js';
import type { ScriptFileEditor } from '@svelte-cli/core';

export function run({ ast }: ScriptFileEditor<any>): void {
	imports.addNamed(ast, 'package', { namedTwo: 'namedTwo' }, false);
}
