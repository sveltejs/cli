import { imports, type AstTypes } from '@sveltejs/cli-core/js';

export function run(ast: AstTypes.Program): void {
	// imports should be added HERE in the reverse order
	// so that the imports are added from the top (unshift)
	imports.addDefault(ast, 'p5', 'MyPackage');
	imports.addEmpty(ast, 'p4');
	imports.addNamed(ast, 'p3', { namedTwo: 'namedTwo' }, false);
	imports.addNamespace(ast, './p2', 'bar');
	imports.addNamespace(ast, 'p1', 'foo');

	// adding the same import twice should not produce two imports
	imports.addNamespace(ast, './p2', 'bar');
	// adding the same import for the 3rd time. Only the first one should be kept.
	imports.addNamespace(ast, './p2', 'bar');
}
