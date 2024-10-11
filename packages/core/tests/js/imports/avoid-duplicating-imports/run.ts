import { imports } from '@sveltejs/cli-core/js';
import type { ScriptFileEditor } from '@sveltejs/cli-core';

export function run({ ast }: ScriptFileEditor<any>): void {
	imports.addEmpty(ast, 'package/file.js');
	imports.addDefault(ast, 'package', 'MyPackage');
	imports.addNamed(ast, 'package2', { Named: 'Named' });
}
