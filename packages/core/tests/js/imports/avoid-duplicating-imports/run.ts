import { imports } from '@svelte-cli/core/js';
import type { ScriptFileEditor } from '@svelte-cli/core';

export function run({ ast }: ScriptFileEditor<any>): void {
	imports.addEmpty(ast, 'package/file.js');
	imports.addDefault(ast, 'package', 'MyPackage');
	imports.addNamed(ast, 'package2', { Named: 'Named' });
}
