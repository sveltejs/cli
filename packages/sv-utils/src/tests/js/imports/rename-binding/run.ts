import { parseScript, type AstTypes } from '../../../../tooling/index.ts';
import { imports } from '../../../../tooling/js/index.ts';

export function run(ast: AstTypes.Program): void {
	const found = imports.bindings(ast, { from: 'pkg' });
	if (found.length !== 8 || found.filter((binding) => binding.isType).length !== 3) {
		throw new Error('Expected value, declaration-level type, and specifier-level type bindings');
	}
	if (
		found.filter((binding) => binding.kind === 'named').length !== 7 ||
		found.filter((binding) => binding.kind === 'namespace').length !== 1 ||
		found.some((binding) => !binding.declaration)
	) {
		throw new Error('Expected complete binding metadata');
	}
	const other = imports.bindings(
		parseScript("import value from 'pkg'; import * as namespace from 'pkg';").ast,
		{ from: 'pkg' }
	);
	if (other[0]?.kind !== 'default' || other[1]?.kind !== 'namespace') {
		throw new Error('Expected default and namespace binding metadata');
	}

	if (!imports.renameBinding([ast], { from: 'pkg', name: 'oldName', to: 'replacement' })) {
		throw new Error('Expected value binding to be renamed');
	}
	imports.renameBinding([ast], { from: 'pkg', name: 'OldType', to: 'NewType' });
	imports.renameBinding([ast], { from: 'pkg', name: 'DeclaredType', to: 'RenamedDeclared' });
	imports.renameBinding([ast], {
		from: 'config',
		name: 'configured',
		to: 'defineConfig',
		local: 'config'
	});
	if (imports.renameBinding([ast], { from: 'pkg', name: 'missing', to: 'unused' })) {
		throw new Error('Expected missing binding to remain unchanged');
	}
}
