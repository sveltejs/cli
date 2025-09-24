import { imports, type AstTypes } from '@sveltejs/cli-core/js';

export function run(ast: AstTypes.Program): void {
	imports.addNamed(ast, { from: 'package', imports: { namedOne: 'namedOneAlias' }, isType: false });

	const result = imports.find(ast, { name: 'namedOne', from: 'package' });

	if (result) {
		imports.addNamed(ast, {
			imports: [result.alias + 'Found'],
			from: 'package'
		});
	}
}
