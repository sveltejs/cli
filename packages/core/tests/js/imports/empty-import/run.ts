import { imports, type AstTypes } from '@sveltejs/cli-core/js';

export function run(ast: AstTypes.Program): void {
	imports.addEmpty(ast, './relativ/file.css');

	// allow importing from npm packages
	imports.addEmpty(ast, 'package/file.css');
}
