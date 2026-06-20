import type { AstTypes, Comments } from '../../../../tooling/index.ts';
import { common } from '../../../../tooling/js/index.ts';

export function run(ast: AstTypes.Program, comments: Comments): void {
	common.appendFromString(ast, {
		comments,
		code: `
			/**
			 * First multiline comment
			 * second line
			 */
			export const foo = 1;
		`
	});

	common.appendFromString(ast, {
		comments,
		code: `
			/**
			 * Second multiline comment
			 * second line
			 */
			export const bar = 2;
		`
	});
}
