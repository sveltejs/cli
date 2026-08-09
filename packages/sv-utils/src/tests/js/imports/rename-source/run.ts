import type { AstTypes } from '../../../../tooling/index.ts';
import { imports } from '../../../../tooling/js/index.ts';

export function run(ast: AstTypes.Program): void {
	const [manual] = imports.findAll(ast, { from: 'manual' });
	imports.setSource(manual, 'set-manually');
	if (!imports.renameSource(ast, { from: 'old', to: 'new' })) {
		throw new Error('Expected import sources to be renamed');
	}
	if (imports.renameSource(ast, { from: 'missing', to: 'new' })) {
		throw new Error('Expected missing import source to remain unchanged');
	}
}
