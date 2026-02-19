import { exports, type AstTypes } from '../../../../tooling/js/index.ts';

export function run(ast: AstTypes.Program): void {
	// With 'as' option
	exports.addNamespace(ast, { from: './auth.schema', as: 'authSchema' });

	// Without 'as' option
	exports.addNamespace(ast, { from: './other' });
	// adding the same export twice should not produce two exports
	exports.addNamespace(ast, { from: './other' });
}
