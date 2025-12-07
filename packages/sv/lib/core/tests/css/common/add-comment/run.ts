import { addComment, type CssAst } from '../../../../tooling/css/index.ts';

export function run(ast: CssAst): void {
	addComment(ast, { value: 'foo comment' });
}
