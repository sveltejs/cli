import { imports, type AstTypes } from '../../../../tooling/js/index.js';

export function run(ast: AstTypes.Program): void {
	imports.addEmpty(ast, { from: './relativ/file.css' });

	// allow importing from npm packages
	imports.addEmpty(ast, { from: 'package/file.css' });
}
