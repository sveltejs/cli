import type { AstTypes } from '../../../../tooling/index.ts';
import { imports } from '../../../../tooling/js/index.ts';

export function run(ast: AstTypes.Program): void {
	imports.addEmpty(ast, { from: './relativ/file.css' });

	// allow importing from npm packages
	imports.addEmpty(ast, { from: 'package/file.css' });
}
