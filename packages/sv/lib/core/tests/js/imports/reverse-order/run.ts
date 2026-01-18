import { imports, type AstTypes } from '../../../../tooling/js/index.js';

export function run(ast: AstTypes.Program): void {
	// imports should be added HERE in the reverse order
	// so that the imports are added from the top (unshift)
	imports.addDefault(ast, { from: 'p5', as: 'MyPackage' });
	imports.addEmpty(ast, { from: 'p4' });
	imports.addNamed(ast, { from: 'p3', imports: { namedTwo: 'namedTwo' }, isType: false });
	imports.addNamespace(ast, { from: './p2', as: 'bar' });
	imports.addNamespace(ast, { from: 'p1', as: 'foo' });

	// adding the same import twice should not produce two imports
	imports.addNamespace(ast, { from: './p2', as: 'bar' });
	// adding the same import for the 3rd time. Only the first one should be kept.
	imports.addNamespace(ast, { from: './p2', as: 'bar' });
}
